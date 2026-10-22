import type { ChatInputCommandInteraction, User } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand, CreateUserMenu } from "@commands";
import type { RepliableInteraction } from "@responders";
import {
  RequireGuildFromInteraction,
  CreateGuildResourceLocator,
  EmbedFactory,
} from "@utilities";
import { PromptModal } from "@shared/ModalPrompt";

async function ExecuteKick(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  await KickUser({
    interaction,
    context,
    targetUser: interaction.options.getUser("user", true),
    reason: interaction.options.getString("reason") ?? "No reason provided",
    notify: interaction.options.getBoolean("notify") ?? false,
  });
}

/**
 * Kicks the user, records the moderation event and optionally DMs them. Shared by `/kick` and
 * the Kick right-click menu.
 */
async function KickUser(options: {
  readonly interaction: RepliableInteraction;
  readonly context: CommandContext;
  readonly targetUser: User;
  readonly reason: string;
  readonly notify: boolean;
}): Promise<void> {
  const { interaction, context, targetUser, reason, notify } = options;
  const { interactionResponder } = context.responders;
  const guild = RequireGuildFromInteraction(interaction);

  const locator = CreateGuildResourceLocator({
    guild,
    logger: context.logger,
  });
  const modDb = context.databases.moderationDb;

  await interactionResponder.WithAction({
    interaction,
    message: {
      embeds: [
        EmbedFactory.Create({
          title: "Processing Kick",
          description: `Kicking **${targetUser.username}**...`,
        }).toJSON(),
      ],
    },
    followUp: () => {
      const embed = EmbedFactory.CreateSuccess({
        title: "User Kicked",
        description: `Successfully kicked **${targetUser.username}**`,
      });

      if (reason !== "No reason provided") {
        embed.addFields([{ name: "Reason", value: reason, inline: false }]);
      }

      return { embeds: [embed.toJSON()] };
    },
    action: async () => {
      const targetMember = await locator.GetMember(targetUser.id);
      if (!targetMember?.kickable) {
        throw new Error(
          "I cannot kick this user. They may have higher permissions than me.",
        );
      }

      await targetMember.kick(reason);

      modDb.AddModerationEvent({
        guild_id: guild.id,
        user_id: targetUser.id,
        moderator_id: interaction.user.id,
        action: "kick",
        reason,
        duration_ms: null,
      });

      if (notify) {
        await interactionResponder.SendDm(
          targetUser,
          `You have been kicked from ${guild.name} for: ${reason}`,
        );
      }
    },
  });
}

export const KickCommand = CreateCommand({
  name: "kick",
  description: "Kick a user from the server",
  group: "moderation",
  config: { access: "mod", cooldown: "5s", botPermissions: ["KickMembers"] },
  execute: ExecuteKick,
  configure: (builder) => {
    builder
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to kick")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for kicking")
          .setRequired(true),
      )
      .addBooleanOption((option) =>
        option.setName("notify").setDescription("Send DM notification to user"),
      );
  },
});

/** Right-click a user → Apps → Kick: asks for a reason (which also confirms), then kicks. */
export const KickUserMenu = CreateUserMenu({
  name: "Kick",
  command: KickCommand,
  execute: async (interaction, context) => {
    const targetUser = interaction.targetUser;
    await PromptModal({
      interaction,
      modalRouter: context.responders.modalRouter,
      title: `Kick ${targetUser.username}`,
      fields: [
        {
          id: "reason",
          label: "Reason",
          style: "paragraph",
          placeholder: "Leave empty for no reason",
          maxLength: 500,
        },
        {
          id: "notify",
          label: "DM them the reason? (yes/no)",
          placeholder: "no",
          maxLength: 3,
        },
      ],
      onSubmit: (submit, values) =>
        KickUser({
          interaction: submit,
          context,
          targetUser,
          reason: values.reason || "No reason provided",
          notify: values.notify.toLowerCase().startsWith("y"),
        }),
    });
  },
});
