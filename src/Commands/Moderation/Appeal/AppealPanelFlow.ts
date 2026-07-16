import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  ComponentFactory,
  EmbedFactory,
  ToActionRowData,
  ResolveInteractionMember,
} from "@utilities";
import { BeginAppealSubmission } from "@commands/Moderation/Appeal/AppealSubmitFlow";
import { IsAppealReviewer } from "@commands/Moderation/Appeal/AppealShared";

export const APPEAL_PANEL_BUTTON_CUSTOM_ID = "appeal-panel:submit";
const PANEL_BUTTON_CUSTOM_ID = APPEAL_PANEL_BUTTON_CUSTOM_ID;
const PANEL_BUTTON_EXPIRY_MS = 1000 * 60 * 60 * 24 * 30;

export async function PostAppealPanelToChannel(
  channel: TextChannel,
): Promise<void> {
  const embed = EmbedFactory.Create({
    title: "Moderation Appeals",
    description:
      "If you believe a warning, mute, ban, or kick was issued in error, you can submit an appeal below.\n\n" +
      "1. Click **Submit Appeal**\n" +
      "2. Select the moderation action\n" +
      "3. Explain your case and add evidence if you have any\n\n" +
      "Staff will review your appeal in a private channel. Use `/appeal my` to check status.\n\n" +
      "*If you were banned and cannot access this server, contact staff through your server's external support process.*",
    color: 0x5865f2,
  });

  const row = ComponentFactory.CreateActionRow({
    buttons: [
      {
        label: "Submit Appeal",
        style: ButtonStyle.Primary,
        emoji: "📋",
      },
    ],
    customIds: [PANEL_BUTTON_CUSTOM_ID],
  });

  await channel.send({
    embeds: [embed.toJSON()],
    components: [ToActionRowData(row)],
  });
}

export function RegisterAppealPanelButton(context: CommandContext): void {
  const { componentRouter } = context.responders;

  componentRouter.RegisterButton({
    customId: PANEL_BUTTON_CUSTOM_ID,
    expiresInMs: PANEL_BUTTON_EXPIRY_MS,
    handler: async (buttonInteraction) => {
      const { interactionResponder } = context.responders;
      const guild = buttonInteraction.guild;
      if (!guild) {
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          content: "Appeals can only be submitted inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const deferred = await interactionResponder.Defer(
        buttonInteraction,
        true,
      );
      if (!deferred.success) {
        return;
      }

      await BeginAppealSubmission({
        interaction: buttonInteraction,
        context,
        guild,
      });
    },
  });
}

export async function HandlePanel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeal panels can only be posted inside a server.",
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
    !IsAppealReviewer(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to post appeal panels.",
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
      description: "Appeal panels can only be posted in server text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  RegisterAppealPanelButton(context);

  await PostAppealPanelToChannel(channel as TextChannel);

  const confirmEmbed = EmbedFactory.CreateSuccess({
    title: "Appeal Panel Posted",
    description: `The appeal panel was posted in ${channel}.`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [confirmEmbed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}
