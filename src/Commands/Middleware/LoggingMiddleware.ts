import { CommandMiddleware } from "./index";

export const LoggingMiddleware: CommandMiddleware = {
  name: "logging",
  execute: async (context, next) => {
    context.logger.Info("Command started", {
      command: context.command.data.name,
      userId: context.interaction.user.id,
      guildId: context.interaction.guildId ?? undefined,
    });
    await next();
  },
};

