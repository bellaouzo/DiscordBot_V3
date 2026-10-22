import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "./index";

/**
 * How long after the chain started to wait before deferring. Discord rejects responses after
 * 3s; this leaves room for the defer request itself.
 */
export const AUTO_DEFER_AFTER_MS = 2000;

/**
 * Opt-in (`Config.create().autoDefer()`): if the handler hasn't replied or deferred by the
 * deadline, defers for it. InteractionResponder.Reply then edits the deferred reply, so handlers
 * keep calling Reply as usual.
 *
 * Only use on commands that respond through the responders: a raw interaction.reply() or
 * showModal() fails once the interaction has been deferred.
 */
export const AutoDeferMiddleware: CommandMiddleware = {
  name: "auto-defer",
  execute: async (context, next) => {
    const autoDefer = context.config.autoDefer;
    if (!autoDefer) {
      await next();
      return;
    }

    const { interaction } = context;
    const delay = Math.max(
      0,
      context.run.startedAt + AUTO_DEFER_AFTER_MS - Date.now(),
    );

    const timer = setTimeout(() => {
      if (interaction.replied || interaction.deferred) {
        return;
      }
      context.logger.Debug("Auto-deferring slow command", {
        command: context.command.data.name,
      });
      void context.responders.interactionResponder.Defer(interaction, {
        flags: autoDefer.ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    }, delay);

    try {
      await next();
    } finally {
      clearTimeout(timer);
    }
  },
};
