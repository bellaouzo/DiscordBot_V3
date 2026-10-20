import { randomUUID } from "crypto";
import type {
  ButtonInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { Logger } from "./Logger";

export type RoutableInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

export type InteractionHandler<T extends RoutableInteraction> = (
  interaction: T,
) => Promise<void> | void;

export interface RegisterInteractionOptions<T extends RoutableInteraction> {
  readonly customId?: string;
  readonly handler: InteractionHandler<T>;
  readonly ownerId?: string;
  readonly expiresInMs?: number;
  readonly singleUse?: boolean;
  readonly onExpire?: () => void;
}

export interface RegisteredInteraction {
  readonly customId: string;
  readonly dispose: () => void;
}

interface InteractionRegistration<T extends RoutableInteraction> {
  readonly handler: InteractionHandler<T>;
  readonly ownerId?: string;
  readonly expiresAt?: number;
  readonly singleUse: boolean;
  readonly onExpire?: () => void;
}

interface RegistrationMatch<T extends RoutableInteraction> {
  readonly registrations: Map<string, InteractionRegistration<T>>;
  readonly key: string;
  readonly registration: InteractionRegistration<T>;
}

/**
 * Routes component/modal interactions to handlers by exact custom ID, falling back to the
 * longest registered prefix. Handles expiry, owner checks, single-use cleanup and handler errors.
 */
export class InteractionRouter<T extends RoutableInteraction> {
  private readonly exact = new Map<string, InteractionRegistration<T>>();
  private readonly prefixed = new Map<string, InteractionRegistration<T>>();

  /**
   * @param logger - Logger for handler failures
   * @param kind - Human-readable interaction kind used in log messages (e.g. "Button")
   */
  constructor(
    protected readonly logger: Logger,
    private readonly kind: string,
  ) {}

  Register(options: RegisterInteractionOptions<T>): RegisteredInteraction {
    return this.Store(this.exact, options.customId ?? randomUUID(), options);
  }

  RegisterPrefix(
    prefix: string,
    options: Omit<RegisterInteractionOptions<T>, "customId">,
  ): RegisteredInteraction {
    return this.Store(this.prefixed, prefix, options);
  }

  async Handle(interaction: T): Promise<boolean> {
    const match = this.FindRegistration(interaction.customId);
    if (!match) {
      return false;
    }

    const { registration } = match;

    if (registration.expiresAt && Date.now() > registration.expiresAt) {
      this.Remove(match);
      await this.ReplyIfNeeded(interaction, "This interaction has expired.");
      return true;
    }

    if (registration.ownerId && registration.ownerId !== interaction.user.id) {
      await this.ReplyIfNeeded(interaction, "You cannot use this interaction.");
      return true;
    }

    try {
      await registration.handler(interaction);
    } catch (error) {
      this.logger.Error(`${this.kind} handler failed`, {
        extra: {
          customId: interaction.customId,
        },
        error,
      });

      await this.ReplyIfNeeded(
        interaction,
        "Something went wrong while handling that interaction.",
      );
    }

    if (registration.singleUse) {
      this.Remove(match);
    }

    return true;
  }

  /**
   * Removes every expired registration, invoking its onExpire callback.
   */
  CleanupExpired(): void {
    const now = Date.now();
    for (const registrations of [this.exact, this.prefixed]) {
      for (const [key, registration] of registrations) {
        if (registration.expiresAt && now > registration.expiresAt) {
          this.Remove({ registrations, key, registration });
        }
      }
    }
  }

  get Size(): number {
    return this.exact.size + this.prefixed.size;
  }

  private Store(
    registrations: Map<string, InteractionRegistration<T>>,
    key: string,
    options: Omit<RegisterInteractionOptions<T>, "customId">,
  ): RegisteredInteraction {
    const registration: InteractionRegistration<T> = {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt: options.expiresInMs
        ? Date.now() + options.expiresInMs
        : undefined,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire,
    };
    registrations.set(key, registration);

    return {
      customId: key,
      dispose: () => {
        const current = registrations.get(key);
        if (current) {
          this.Remove({ registrations, key, registration: current });
        }
      },
    };
  }

  private Remove(match: RegistrationMatch<T>): void {
    // Only remove if the slot still holds this registration; a handler may have re-registered the key.
    if (match.registrations.get(match.key) !== match.registration) {
      return;
    }
    match.registrations.delete(match.key);
    match.registration.onExpire?.();
  }

  private FindRegistration(customId: string): RegistrationMatch<T> | undefined {
    const exact = this.exact.get(customId);
    if (exact) {
      return { registrations: this.exact, key: customId, registration: exact };
    }

    let match: RegistrationMatch<T> | undefined;
    for (const [prefix, registration] of this.prefixed) {
      if (
        customId.startsWith(prefix) &&
        prefix.length > (match?.key.length ?? 0)
      ) {
        match = { registrations: this.prefixed, key: prefix, registration };
      }
    }
    return match;
  }

  private async ReplyIfNeeded(interaction: T, content: string): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      return;
    }

    const options: InteractionReplyOptions = {
      content,
      flags: MessageFlags.Ephemeral,
    };

    try {
      await (interaction as ButtonInteraction).reply(options);
    } catch (error) {
      this.logger.Warn(`Could not reply to ${this.kind.toLowerCase()}`, {
        extra: { customId: interaction.customId },
        error,
      });
    }
  }
}
