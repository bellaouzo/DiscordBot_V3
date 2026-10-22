import type { CommandMiddleware } from "./index";

/** Commands slower than this get a warning, so they can be given `autoDefer: true`. */
export const SLOW_COMMAND_THRESHOLD_MS = 2500;

/**
 * Logs each command's start and its outcome: completed (with duration), blocked (with the
 * middleware that stopped it), or threw (the error is rethrown for ErrorMiddleware).
 */
export const LoggingMiddleware: CommandMiddleware = {
  name: "logging",
  execute: async (context, next) => {
    context.logger.Info("Command started", {
      command: context.invocation.path,
      userId: context.interaction.user.id,
      guildId: context.interaction.guildId ?? undefined,
    });

    const startedAt = Date.now();
    try {
      await next();
    } catch (error) {
      context.logger.Warn("Command threw", {
        command: context.invocation.path,
        extra: { durationMs: Date.now() - startedAt },
      });
      throw error;
    }

    const durationMs = Date.now() - startedAt;

    if (!context.run.reachedHandler) {
      context.logger.Info("Command blocked", {
        command: context.invocation.path,
        extra: { blockedBy: context.run.blockedBy, durationMs },
      });
      return;
    }

    if (durationMs > SLOW_COMMAND_THRESHOLD_MS) {
      context.logger.Warn("Command slow", {
        command: context.invocation.path,
        extra: {
          durationMs,
          autoDefer: Boolean(context.config.autoDefer),
        },
      });
      return;
    }

    context.logger.Info("Command completed", {
      command: context.invocation.path,
      extra: { durationMs },
    });
  },
};
