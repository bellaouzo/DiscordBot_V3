import { randomUUID } from "crypto";
import { ButtonInteraction, InteractionReplyOptions, MessageFlags } from "discord.js";
import { Logger } from "./Logger";

export type ButtonHandler = (
  interaction: ButtonInteraction,
) => Promise<void> | void;

export interface RegisterButtonOptions {
  readonly customId?: string;
  readonly prefix?: string;
  readonly handler: ButtonHandler;
  readonly ownerId?: string;
  readonly expiresInMs?: number;
  readonly singleUse?: boolean;
  readonly onExpire?: () => void;
}

interface ButtonRegistration {
  readonly handler: ButtonHandler;
  readonly ownerId?: string;
  readonly expiresAt?: number;
  readonly singleUse: boolean;
  readonly onExpire?: () => void;
}

export interface RegisteredButton {
  readonly customId: string;
  readonly dispose: () => void;
}

export class ComponentRouter {
  private readonly buttons = new Map<string, ButtonRegistration>();
  private readonly prefixButtons = new Map<string, ButtonRegistration>();

  constructor(private readonly logger: Logger) {}

  RegisterButton(options: RegisterButtonOptions): RegisteredButton {
    if (options.prefix) {
      return this.RegisterButtonPrefix(options.prefix, options);
    }

    const customId = options.customId ?? randomUUID();
    const expiresAt = options.expiresInMs
      ? Date.now() + options.expiresInMs
      : undefined;

    this.buttons.set(customId, {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire,
    });

    return {
      customId,
      dispose: () => {
        const registration = this.buttons.get(customId);
        if (!registration) {
          return;
        }
        this.buttons.delete(customId);
        registration.onExpire?.();
      },
    };
  }

  RegisterButtonPrefix(
    prefix: string,
    options: Omit<RegisterButtonOptions, "customId" | "prefix">
  ): RegisteredButton {
    const expiresAt = options.expiresInMs
      ? Date.now() + options.expiresInMs
      : undefined;

    this.prefixButtons.set(prefix, {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire,
    });

    return {
      customId: prefix,
      dispose: () => {
        const registration = this.prefixButtons.get(prefix);
        if (!registration) {
          return;
        }
        this.prefixButtons.delete(prefix);
        registration.onExpire?.();
      },
    };
  }

  async HandleButton(interaction: ButtonInteraction): Promise<boolean> {
    let registration = this.buttons.get(interaction.customId);

    if (!registration) {
      registration = this.FindPrefixRegistration(interaction.customId);
    }

    if (!registration) {
      return false;
    }

    const now = Date.now();
    if (registration.expiresAt && now > registration.expiresAt) {
      this.buttons.delete(interaction.customId);
      registration.onExpire?.();
      await this.ReplyIfNeeded(interaction, {
        content: "This interaction has expired.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (registration.ownerId && registration.ownerId !== interaction.user.id) {
      await this.ReplyIfNeeded(interaction, {
        content: "You cannot use this interaction.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    try {
      await registration.handler(interaction);
    } catch (error) {
      this.logger.Error("Button handler failed", {
        extra: {
          customId: interaction.customId,
        },
        error,
      });

      await this.ReplyIfNeeded(interaction, {
        content: "Something went wrong while handling that interaction.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (registration.singleUse) {
      this.buttons.delete(interaction.customId);
      registration.onExpire?.();
    }

    return true;
  }

  private FindPrefixRegistration(
    customId: string
  ): ButtonRegistration | undefined {
    let match: ButtonRegistration | undefined;
    let longestPrefix = 0;

    for (const [prefix, registration] of this.prefixButtons) {
      if (customId.startsWith(prefix) && prefix.length > longestPrefix) {
        match = registration;
        longestPrefix = prefix.length;
      }
    }

    return match;
  }

  private async ReplyIfNeeded(
    interaction: ButtonInteraction,
    options: InteractionReplyOptions,
  ): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      return;
    }

    await interaction.reply(options);
  }
}

export function CreateComponentRouter(logger: Logger): ComponentRouter {
  return new ComponentRouter(logger);
}
