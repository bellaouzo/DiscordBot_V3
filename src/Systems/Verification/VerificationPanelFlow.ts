import type {
  ChatInputCommandInteraction,
  Guild,
  TextChannel,
} from "discord.js";
import { ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import type { GuildSettings } from "@database/Server/Types";
import {
  ComponentFactory,
  EmbedFactory,
  ToActionRowData,
  IsModerator,
  ResolveInteractionMember,
} from "@utilities";
import {
  BuildVerificationEligibility,
  EnsureUnverifiedRoleForMember,
  VerifyGuildMember,
} from "@systems/Verification/VerifyMember";
import {
  BuildEligibilityEmbed,
  BuildVerificationConfirmEmbed,
  BuildVerificationPanelEmbed,
  BuildVerificationSuccessEmbed,
} from "@systems/Verification/VerificationPanelPresentation";

export const VERIFICATION_PANEL_BEGIN_CUSTOM_ID = "verification-panel:begin";
export const VERIFICATION_PANEL_CHECK_CUSTOM_ID = "verification-panel:check";
export const VERIFICATION_PANEL_CONFIRM_CUSTOM_ID =
  "verification-panel:confirm";

const CONFIRM_SESSION_MS = 1000 * 60 * 10;

export async function PostVerificationPanelToChannel(options: {
  channel: TextChannel;
  guild: Guild;
  settings: GuildSettings;
}): Promise<void> {
  const actionRow = ComponentFactory.CreateActionRow({
    buttons: [
      {
        label: "Begin Verification",
        style: ButtonStyle.Primary,
        emoji: "🚀",
      },
      {
        label: "Check Eligibility",
        style: ButtonStyle.Secondary,
        emoji: "🔍",
      },
    ],
    customIds: [
      VERIFICATION_PANEL_BEGIN_CUSTOM_ID,
      VERIFICATION_PANEL_CHECK_CUSTOM_ID,
    ],
  });

  await options.channel.send({
    embeds: [BuildVerificationPanelEmbed(options.guild, options.settings)],
    components: [ToActionRowData(actionRow)],
  });
}

export function RegisterVerificationPanelButton(context: CommandContext): void {
  RegisterVerificationPanelButtons(context);
}

export function RegisterVerificationPanelButtons(
  context: CommandContext,
): void {
  const { componentRouter, buttonResponder } = context.responders;

  componentRouter.RegisterButton({
    customId: VERIFICATION_PANEL_CHECK_CUSTOM_ID,
    handler: async (buttonInteraction) => {
      const guild = buttonInteraction.guild;
      if (!guild) {
        await buttonResponder.Reply(buttonInteraction, {
          content: "Verification can only be checked inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      const settings = context.databases.serverDb.GetGuildSettings(guild.id);
      if (!settings?.verification_enabled) {
        const embed = EmbedFactory.CreateWarning({
          title: "Verification Disabled",
          description: "Verification is not enabled in this server.",
        });
        await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
        return;
      }

      const member = await guild.members.fetch(buttonInteraction.user.id);
      let resolvedMember = member;

      try {
        resolvedMember = await EnsureUnverifiedRoleForMember({
          member,
          settings,
        });
      } catch (error) {
        context.logger.Warn(
          "Failed to assign unverified role during eligibility check",
          {
            error,
            extra: { guildId: guild.id, userId: member.id },
          },
        );
      }

      const eligibility = BuildVerificationEligibility(
        resolvedMember,
        settings,
      );
      await buttonInteraction.editReply({
        embeds: [BuildEligibilityEmbed(resolvedMember, eligibility)],
      });
    },
  });

  componentRouter.RegisterButton({
    customId: VERIFICATION_PANEL_BEGIN_CUSTOM_ID,
    handler: async (buttonInteraction) => {
      const guild = buttonInteraction.guild;
      if (!guild) {
        await buttonResponder.Reply(buttonInteraction, {
          content: "Verification can only be completed inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      const settings = context.databases.serverDb.GetGuildSettings(guild.id);
      if (!settings?.verification_enabled) {
        const embed = EmbedFactory.CreateWarning({
          title: "Verification Disabled",
          description: "Verification is not enabled in this server.",
        });
        await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
        return;
      }

      const member = await guild.members.fetch(buttonInteraction.user.id);
      let resolvedMember = member;

      try {
        resolvedMember = await EnsureUnverifiedRoleForMember({
          member,
          settings,
        });
      } catch (error) {
        context.logger.Warn(
          "Failed to assign unverified role during verification begin",
          {
            error,
            extra: { guildId: guild.id, userId: member.id },
          },
        );
      }

      const eligibility = BuildVerificationEligibility(
        resolvedMember,
        settings,
      );

      if (
        eligibility.alreadyVerified ||
        !eligibility.unverifiedRoleConfigured ||
        !eligibility.hasUnverifiedRole
      ) {
        await buttonInteraction.editReply({
          embeds: [BuildEligibilityEmbed(resolvedMember, eligibility)],
        });
        return;
      }

      componentRouter.RegisterButton({
        customId: VERIFICATION_PANEL_CONFIRM_CUSTOM_ID,
        ownerId: buttonInteraction.user.id,
        expiresInMs: CONFIRM_SESSION_MS,
        singleUse: true,
        handler: async (confirmInteraction) => {
          await confirmInteraction.deferUpdate();

          const confirmSettings = context.databases.serverDb.GetGuildSettings(
            guild.id,
          );
          if (!confirmSettings?.verification_enabled) {
            const embed = EmbedFactory.CreateWarning({
              title: "Verification Disabled",
              description: "Verification is no longer enabled in this server.",
            });
            await confirmInteraction.editReply({
              embeds: [embed.toJSON()],
              components: [],
            });
            return;
          }

          const confirmMember = await guild.members.fetch(
            confirmInteraction.user.id,
          );
          const result = await VerifyGuildMember({
            member: confirmMember,
            settings: confirmSettings,
          });

          if (!result.success) {
            const embed = EmbedFactory.CreateError({
              title: "Verification Failed",
              description: result.reason,
            });
            await confirmInteraction.editReply({
              embeds: [embed.toJSON()],
              components: [],
            });
            return;
          }

          await confirmInteraction.editReply({
            embeds: [
              BuildVerificationSuccessEmbed(confirmMember, confirmSettings),
            ],
            components: [],
          });
        },
      });

      const confirmRow = ComponentFactory.CreateActionRow({
        buttons: [
          {
            label: "I Agree — Verify Me",
            style: ButtonStyle.Success,
            emoji: "✅",
          },
        ],
        customIds: [VERIFICATION_PANEL_CONFIRM_CUSTOM_ID],
      });

      await buttonInteraction.editReply({
        embeds: [
          BuildVerificationConfirmEmbed(
            resolvedMember,
            settings,
            eligibility,
          ),
        ],
        components: [ToActionRowData(confirmRow)],
      });
    },
  });
}

export async function HandleVerificationPanel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Verification panels can only be posted inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);

  if (
    !IsModerator(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to post verification panels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!settings?.verification_enabled || !settings.unverified_role_id) {
    const embed = EmbedFactory.CreateWarning({
      title: "Verification Not Configured",
      description:
        "Enable verification and set an unverified role before posting a panel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description:
        "Verification panels can only be posted in server text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  RegisterVerificationPanelButtons(context);

  await PostVerificationPanelToChannel({
    channel: channel as TextChannel,
    guild: interaction.guild,
    settings,
  });

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: interaction.guild.id,
    verification_channel_id: channel.id,
  });

  const confirmEmbed = EmbedFactory.CreateSuccess({
    title: "Verification Panel Posted",
    description: `The verification panel was posted in ${channel}.`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [confirmEmbed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}
