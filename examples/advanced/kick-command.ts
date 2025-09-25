import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands/CommandFactory";
import {
  LoggingMiddleware,
  PermissionMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../../src/Commands/Middleware";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * Advanced kick command with options and permissions
 * Demonstrates:
 * - Command options (user, string, boolean)
 * - Permission middleware
 * - Action responder with error handling
 * - DM notifications
 */
async function ExecuteKick(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { actionResponder, dmResponder } = context.responders;
  const { logger } = context;

  // Get command options
  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;

  await actionResponder.Send({
    interaction,
    message: `Kicking ${targetUser.username}...`,
    followUp: `✅ Successfully kicked **${targetUser.username}** for: ${reason}`,
    action: async () => {
      logger.Info("Attempting to kick user", {
        extra: { targetUserId: targetUser.id },
      });
      
      const targetMember = await interaction.guild?.members.fetch(
        targetUser.id
      );

      if (!targetMember) {
        throw new Error("User not found in this server.");
      }
      if (!targetMember.kickable) {
        throw new Error(
          "I cannot kick this user. They may have higher permissions than me."
        );
      }

      await targetMember.kick(reason);
      logger.Info("User kicked", {
        extra: { targetUserId: targetUser.id, reason },
      });

      // Send DM notification if requested
      if (notify) {
        await dmResponder.Send(
          targetUser,
          `You have been kicked from ${
            interaction.guild?.name ?? "this server"
          } for: ${reason}`
        );
      }
    },
  });
}

export const KickCommand = CreateCommand({
  name: "kick",
  description: "Kick a user from the server",
  group: "moderation",
  configure: (builder) => {
    builder
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to kick")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for kicking")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option.setName("notify").setDescription("Send DM notification to user")
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.moderation(5), // 5 second cooldown, requires permissions
  execute: ExecuteKick,
});
