import { MessageFlags } from "discord.js";
import type { CommandConfig } from "./CommandConfig";
import type { CommandMiddleware, MiddlewareContext } from "./index";
import { CreateErrorMessage } from "@responders/MessageFactory";
import { GetCooldownStateStore } from "./CooldownState";

export function ResolveCooldownMs(
  cooldownConfig: NonNullable<CommandConfig["cooldown"]>,
): number {
  if (cooldownConfig.milliseconds) {
    return cooldownConfig.milliseconds;
  }
  if (cooldownConfig.seconds) {
    return cooldownConfig.seconds * 1000;
  }
  if (cooldownConfig.minutes) {
    return cooldownConfig.minutes * 60 * 1000;
  }
  return 0;
}

export function BuildCooldownKey(userId: string, commandName: string): string {
  return `${userId}:${commandName}`;
}

/**
 * Starts the cooldown for this user and command now. Returns the key and the expiry that was
 * set, or null when the command has no cooldown.
 */
export function RecordCooldown(
  context: MiddlewareContext,
): { key: string; expiresAt: number } | null {
  const cooldownConfig = context.config.cooldown;
  if (!cooldownConfig) {
    return null;
  }

  const cooldownMs = ResolveCooldownMs(cooldownConfig);
  if (cooldownMs === 0) {
    return null;
  }

  const key = BuildCooldownKey(
    context.interaction.user.id,
    context.command.data.name,
  );
  const now = Date.now();
  const expiresAt = now + cooldownMs;
  const store = GetCooldownStateStore();
  store.Set(key, expiresAt);
  store.Prune(now);
  return { key, expiresAt };
}

export function ResetCooldownsForTesting(): void {
  GetCooldownStateStore().Clear();
}

/**
 * Rejects the command while the user's cooldown is active; otherwise reserves the cooldown and
 * runs the rest of the chain, releasing the reservation if the command throws.
 */
export const CooldownMiddleware: CommandMiddleware = {
  name: "cooldown",
  execute: async (context, next) => {
    const cooldownConfig = context.config.cooldown;

    if (!cooldownConfig) {
      await next();
      return;
    }

    const cooldownMs = ResolveCooldownMs(cooldownConfig);
    if (cooldownMs === 0) {
      await next();
      return;
    }

    const key = BuildCooldownKey(
      context.interaction.user.id,
      context.command.data.name,
    );
    const expiresAt = GetCooldownStateStore().Get(key);
    const now = Date.now();

    if (expiresAt && now < expiresAt) {
      const remaining = Math.ceil((expiresAt - now) / 1000);
      const message = CreateErrorMessage({
        title: "⏱️ Command Cooldown",
        description: `Please wait ${remaining} second${
          remaining !== 1 ? "s" : ""
        } before using this command again.`,
        hint: "This helps prevent command spam.",
      });
      await context.responders.interactionResponder.Reply(context.interaction, {
        ...message,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Reserve before running so concurrent invocations (spam-clicks) see the cooldown at once,
    // instead of all passing the check while the first one is still executing.
    const reservation = RecordCooldown(context);

    try {
      await next();
    } catch (error) {
      // A failed command shouldn't lock the user out. Only release our own reservation.
      if (reservation) {
        const store = GetCooldownStateStore();
        if (store.Get(reservation.key) === reservation.expiresAt) {
          store.Delete(reservation.key);
        }
      }
      throw error;
    }
  },
};
