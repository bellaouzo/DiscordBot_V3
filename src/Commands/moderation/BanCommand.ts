import { CreateCommand } from "..";
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "../CommandFactory";
import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
import { PermissionMiddleware } from "../Middleware/PermissionMiddleware";
import { ErrorMiddleware } from "../Middleware/ErrorMiddleware";
import { Config } from "../Middleware/CommandConfig";
import { CreateGuildResourceLocator, EmbedFactory } from "../../Utilities";

async function ExecuteBan(
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

  await interactionResponder.WithAction({
    interaction,
    message: `Banning ${targetUser.username}...`,
    followUp: () => {
      const embed = EmbedFactory.CreateSuccess({
        title: "User Banned",
        description: `Successfully banned **${targetUser.username}**`,
      });
      
      if (reason !== "No reason provided") {
        embed.addFields([{ name: "Reason", value: reason, inline: false }]);
      }
      
      return { embeds: [embed.toJSON()] };
    },
    action: async () => {
      const targetMember = await locator.GetMember(targetUser.id);
      if (!targetMember?.bannable) {
        throw new Error(
          "I cannot ban this user. They may have higher permissions than me."
        );
      }

      await targetMember.ban({ reason: reason });

      if (notify) {
        await interactionResponder.SendDm(
          targetUser,
          `You have been banned from ${
            interaction.guild?.name ?? "this server"
          } for: ${reason}`
        );
      }
    },
  });
}

export const BanCommand = CreateCommand({
  name: "ban",
  description: "Ban a user from the server",
  group: "moderation",
  configure: (builder) => {
    builder
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to ban")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for banning")
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
  execute: ExecuteBan,
});
