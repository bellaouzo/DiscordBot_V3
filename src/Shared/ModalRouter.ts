import { randomUUID } from "crypto";
import type {
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { Logger } from "./Logger";

export type ModalHandler = (
  interaction: ModalSubmitInteraction,
) => Promise<void> | void;

export interface RegisterModalOptions {
  readonly customId?: string;
  readonly handler: ModalHandler;
  readonly ownerId?: string;
  readonly expiresInMs?: number;
  readonly singleUse?: boolean;
  readonly onExpire?: () => void;
}

interface ModalRegistration {
  readonly handler: ModalHandler;
  readonly ownerId?: string;
  readonly expiresAt?: number;
  readonly singleUse: boolean;
  readonly onExpire?: () => void;
}

export interface RegisteredModal {
  readonly customId: string;
  readonly dispose: () => void;
}

export class ModalRouter {
  private readonly modals = new Map<string, ModalRegistration>();

  constructor(private readonly logger: Logger) {}

  RegisterModal(options: RegisterModalOptions): RegisteredModal {
    const customId = options.customId ?? randomUUID();
    const expiresAt = options.expiresInMs
      ? Date.now() + options.expiresInMs
      : undefined;

    this.modals.set(customId, {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire,
    });

    return {
      customId,
      dispose: () => {
        const registration = this.modals.get(customId);
        if (!registration) {
          return;
        }
        this.modals.delete(customId);
        registration.onExpire?.();
      },
    };
  }

  async HandleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    const registration = this.modals.get(interaction.customId);
    if (!registration) {
      return false;
    }

    const now = Date.now();
    if (registration.expiresAt && now > registration.expiresAt) {
      this.modals.delete(interaction.customId);
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
      this.logger.Error("Modal handler failed", {
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
      this.modals.delete(interaction.customId);
      registration.onExpire?.();
    }

    return true;
  }

  private async ReplyIfNeeded(
    interaction: ModalSubmitInteraction,
    options: InteractionReplyOptions,
  ): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      return;
    }
    await interaction.reply(options);
  }
}

export function CreateModalRouter(logger: Logger): ModalRouter {
  return new ModalRouter(logger);
}
