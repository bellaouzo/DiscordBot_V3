import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { Config } from "@middleware/CommandConfig";
import { CreateGuildResourceLocator, EmbedFactory } from "@utilities";
import { ModerationDatabase } from "@database";

async function ExecuteKick(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  const targetUser = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;

  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
    logger,
  });
  const modDb = new ModerationDatabase(context.logger);

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
          "I cannot kick this user. They may have higher permissions than me."
        );
      }

      await targetMember.kick(reason);

      modDb.AddModerationEvent({
        guild_id: interaction.guild!.id,
        user_id: targetUser.id,
        moderator_id: interaction.user.id,
        action: "kick",
        reason,
        duration_ms: null,
      });

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

  modDb.Close();
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
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.moderation(5),
  execute: ExecuteKick,
});
