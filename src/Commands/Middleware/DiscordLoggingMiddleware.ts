import type { CommandMiddleware } from "./index";
import { CreateDiscordLogger } from "@utilities/DiscordLogger";
import type { Guild } from "discord.js";
import { AppendCommandLog } from "@utilities/CommandLogStore";

export const DiscordLoggingMiddleware: CommandMiddleware = {
  name: "discord-logging",
  execute: async (context, next) => {
    await next();

    if (!context.interaction.guild) {
      return;
    }

    try {
      const guild = context.interaction.guild as Guild;
      const settings = context.databases.serverDb.GetGuildSettings(guild.id);
      const discordLogger = CreateDiscordLogger({
        guild,
        logger: context.logger,
        config: context.appConfig.logging,
        commandLogChannelId: settings?.command_log_channel_id,
      });

      await discordLogger.LogCommandExecution(
        context.interaction,
        context.invocation,
      );

      await AppendCommandLog(context.interaction, context.invocation);
    } catch (error) {
      context.logger.Error("Discord logging middleware failed", {
        error,
        extra: {
          commandName: context.invocation.path,
          userId: context.interaction.user.id,
          guildId: context.interaction.guildId,
        },
      });
    }
  },
};
