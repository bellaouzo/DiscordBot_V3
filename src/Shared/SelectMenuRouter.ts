import { randomUUID } from "crypto";
import {
  StringSelectMenuInteraction,
  InteractionReplyOptions,
} from "discord.js";
import { Logger } from "./Logger";

export type SelectMenuHandler = (
  interaction: StringSelectMenuInteraction,
) => Promise<void> | void;

export interface RegisterSelectMenuOptions {
  readonly customId?: string;
  readonly handler: SelectMenuHandler;
  readonly ownerId?: string;
  readonly expiresInMs?: number;
  readonly singleUse?: boolean;
  readonly onExpire?: () => void;
}

interface SelectMenuRegistration {
  readonly handler: SelectMenuHandler;
  readonly ownerId?: string;
  readonly expiresAt?: number;
  readonly singleUse: boolean;
  readonly onExpire?: () => void;
}

export interface RegisteredSelectMenu {
  readonly customId: string;
  readonly dispose: () => void;
}

export class SelectMenuRouter {
  private readonly menus = new Map<string, SelectMenuRegistration>();

  constructor(private readonly logger: Logger) {}

  RegisterSelectMenu(options: RegisterSelectMenuOptions): RegisteredSelectMenu {
    const customId = options.customId ?? randomUUID();
    const expiresAt = options.expiresInMs
      ? Date.now() + options.expiresInMs
      : undefined;

    this.menus.set(customId, {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire,
    });

    return {
      customId,
      dispose: () => {
        const registration = this.menus.get(customId);
        if (!registration) {
          return;
        }
        this.menus.delete(customId);
        registration.onExpire?.();
      },
    };
  }

  async HandleSelectMenu(
    interaction: StringSelectMenuInteraction,
  ): Promise<boolean> {
    const registration = this.menus.get(interaction.customId);

    if (!registration) {
      return false;
    }

    const now = Date.now();
    if (registration.expiresAt && now > registration.expiresAt) {
      this.menus.delete(interaction.customId);
      registration.onExpire?.();
      await this.ReplyIfNeeded(interaction, {
        content: "This interaction has expired.",
        ephemeral: true,
      });
      return true;
    }

    if (registration.ownerId && registration.ownerId !== interaction.user.id) {
      await this.ReplyIfNeeded(interaction, {
        content: "You cannot use this interaction.",
        ephemeral: true,
      });
      return true;
    }

    try {
      await registration.handler(interaction);
    } catch (error) {
      this.logger.Error("Select menu handler failed", {
        extra: {
          customId: interaction.customId,
        },
        error,
      });

      await this.ReplyIfNeeded(interaction, {
        content: "Something went wrong while handling that interaction.",
        ephemeral: true,
      });
    }

    if (registration.singleUse) {
      this.menus.delete(interaction.customId);
      registration.onExpire?.();
    }

    return true;
  }

  private async ReplyIfNeeded(
    interaction: StringSelectMenuInteraction,
    options: InteractionReplyOptions,
  ): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      return;
    }

    await interaction.reply(options);
  }
}

export function CreateSelectMenuRouter(logger: Logger): SelectMenuRouter {
  return new SelectMenuRouter(logger);
}
