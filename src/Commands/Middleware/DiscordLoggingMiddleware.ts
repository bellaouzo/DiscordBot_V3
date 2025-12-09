import { CommandMiddleware } from "./index";
import { CreateDiscordLogger, DiscordLogger } from "@utilities/DiscordLogger";
import { Guild } from "discord.js";
import { LoadAppConfig } from "@config/AppConfig";

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
        const appConfig = LoadAppConfig();
        discordLogger = CreateDiscordLogger({
          guild,
          logger: context.logger,
          config: appConfig.logging,
        });
      }

      await discordLogger.LogCommandExecution(
        context.interaction,
        context.command
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

