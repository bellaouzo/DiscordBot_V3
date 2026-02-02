import { CommandMiddleware } from "./index";
import { CreateDiscordLogger, DiscordLogger } from "@utilities/DiscordLogger";
import { Guild } from "discord.js";
import { AppendCommandLog } from "@utilities/CommandLogStore";

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
          config: context.appConfig.logging,
        });
      }

      await discordLogger.LogCommandExecution(
        context.interaction,
        context.command
      );

      await AppendCommandLog(context.interaction, context.command);
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
