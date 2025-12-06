import { UserSelectMenuInteraction } from "discord.js";
import { Logger } from "./Logger";
import { randomUUID } from "crypto";

export interface RegisterUserSelectMenuOptions {
  readonly customId?: string;
  readonly handler: (interaction: UserSelectMenuInteraction) => Promise<void>;
  readonly ownerId: string;
  readonly singleUse?: boolean;
  readonly expiresInMs?: number;
  readonly onExpire?: () => void;
}

export interface UserSelectMenuRegistration {
  readonly handler: (interaction: UserSelectMenuInteraction) => Promise<void>;
  readonly ownerId: string;
  readonly expiresAt?: number;
  readonly singleUse: boolean;
  readonly onExpire?: () => void;
}

export interface RegisteredUserSelectMenu {
  readonly customId: string;
  readonly dispose: () => void;
}

export class UserSelectMenuRouter {
  private readonly menus = new Map<string, UserSelectMenuRegistration>();

  constructor(private readonly logger: Logger) {}

  RegisterUserSelectMenu(
    options: RegisterUserSelectMenuOptions,
  ): RegisteredUserSelectMenu {
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

  async HandleUserSelectMenu(
    interaction: UserSelectMenuInteraction,
  ): Promise<boolean> {
    const registration = this.menus.get(interaction.customId);

    if (!registration) {
      return false;
    }

    if (registration.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: "This interaction is not for you.",
        ephemeral: true,
      });
      return true;
    }

    if (registration.expiresAt && Date.now() > registration.expiresAt) {
      this.menus.delete(interaction.customId);
      registration.onExpire?.();
      await interaction.reply({
        content: "This interaction has expired.",
        ephemeral: true,
      });
      return true;
    }

    try {
      await registration.handler(interaction);

      if (registration.singleUse) {
        this.menus.delete(interaction.customId);
        registration.onExpire?.();
      }

      return true;
    } catch (error) {
      this.logger.Error("User select menu handler error", { error });
      await interaction
        .reply({
          content: "An error occurred while processing your request.",
          ephemeral: true,
        })
        .catch(() => {});
      return true;
    }
  }

  CleanupExpiredMenus(): void {
    const now = Date.now();
    for (const [customId, registration] of this.menus.entries()) {
      if (registration.expiresAt && now > registration.expiresAt) {
        this.menus.delete(customId);
        registration.onExpire?.();
      }
    }
  }

  GetMenuCount(): number {
    return this.menus.size;
  }
}

export function CreateUserSelectMenuRouter(
  logger: Logger,
): UserSelectMenuRouter {
  return new UserSelectMenuRouter(logger);
}
