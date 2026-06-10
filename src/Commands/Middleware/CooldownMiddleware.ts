import { MessageFlags } from "discord.js";
import { CommandConfig } from "./CommandConfig";
import { CommandMiddleware, MiddlewareContext } from "./index";
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

export function RecordCooldown(context: MiddlewareContext): void {
  const cooldownConfig = context.config.cooldown;
  if (!cooldownConfig) {
    return;
  }

  const cooldownMs = ResolveCooldownMs(cooldownConfig);
  if (cooldownMs === 0) {
    return;
  }

  const key = BuildCooldownKey(
    context.interaction.user.id,
    context.command.data.name,
  );
  const now = Date.now();
  const store = GetCooldownStateStore();
  store.Set(key, now + cooldownMs);
  store.Prune(now);
}

export function ResetCooldownsForTesting(): void {
  GetCooldownStateStore().Clear();
}

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

    await next();
  },
};
