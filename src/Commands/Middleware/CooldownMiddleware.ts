import { CommandMiddleware } from "./index";
import { CreateErrorMessage } from "@responders/MessageFactory";

const cooldowns = new Map<string, number>();

export const CooldownMiddleware: CommandMiddleware = {
  name: "cooldown",
  execute: async (context, next) => {
    const config = context.config;
    const cooldownConfig = config.cooldown;

    if (!cooldownConfig) {
      await next();
      return;
    }

    const userId = context.interaction.user.id;
    const commandName = context.command.data.name;

    let cooldownMs = 0;
    if (cooldownConfig.milliseconds) {
      cooldownMs = cooldownConfig.milliseconds;
    } else if (cooldownConfig.seconds) {
      cooldownMs = cooldownConfig.seconds * 1000;
    } else if (cooldownConfig.minutes) {
      cooldownMs = cooldownConfig.minutes * 60 * 1000;
    }

    if (cooldownMs === 0) {
      await next();
      return;
    }

    const key = `${userId}:${commandName}`;
    const expiresAt = cooldowns.get(key);
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
        ephemeral: true,
      });
      return;
    }

    cooldowns.set(key, now + cooldownMs);

    if (cooldowns.size > 100) {
      for (const [k, expiry] of cooldowns.entries()) {
        if (now >= expiry) {
          cooldowns.delete(k);
        }
      }
    }

    await next();
  },
};

