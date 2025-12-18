import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import {
  LoggingMiddleware,
  PermissionMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../../src/Commands/Middleware/index";
import { Config } from "../../src/Commands/Middleware/CommandConfig";
import { CreateGuildResourceLocator, EmbedFactory } from "../../src/Utilities";

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
  const { interactionResponder } = context.responders;
  const { logger } = context;

  // Get command options
  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;

  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
    logger,
  });

  await interactionResponder.WithAction({
    interaction,
    message: `Kicking ${targetUser.username}...`,
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
          "I cannot kick this user. They may have higher permissions than me."
        );
      }

      await targetMember.kick(reason);

      // Send DM notification if requested
      if (notify) {
        await interactionResponder.SendDm(
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
  config: Config.mod(5).build(), // 5 second cooldown, requires mod role
  execute: ExecuteKick,
});
