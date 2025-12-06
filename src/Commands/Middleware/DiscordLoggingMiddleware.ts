import { CommandMiddleware } from "./index";
import {
  CreateDiscordLogger,
  DiscordLogger,
} from "../../Utilities/DiscordLogger";
import { Guild } from "discord.js";

let discordLogger: DiscordLogger | null = null;

export const DiscordLoggingMiddleware: CommandMiddleware = {
  name: "discord-logging",
  execute: async (context, next) => {
    await next();

    if (!context.interaction.guild) {
      return;
    }

    try {
      if (!discordLogger) {
        const guild = context.interaction.guild as Guild;
        discordLogger = CreateDiscordLogger({
          guild,
          logger: context.logger,
          config: {
            commandLogChannelName:
              process.env.COMMAND_LOG_CHANNEL_NAME || "command-logs",
            commandLogCategoryName:
              process.env.COMMAND_LOG_CATEGORY_NAME || "Bot Logs",
          },
        });
      }

      await discordLogger.LogCommandExecution(
        context.interaction,
        context.command,
      );
    } catch (error) {
      context.logger.Error("Discord logging middleware failed", {
        error,
        extra: {
          commandName: context.command.data.name,
          userId: context.interaction.user.id,
          guildId: context.interaction.guildId,
        },
      });
    }
  },
};
