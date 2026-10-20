import type { UserSelectMenuInteraction } from "discord.js";
import type { Logger } from "./Logger";
import type {
  RegisterInteractionOptions,
  RegisteredInteraction,
} from "./InteractionRouter";
import { InteractionRouter } from "./InteractionRouter";

export interface RegisterUserSelectMenuOptions extends RegisterInteractionOptions<UserSelectMenuInteraction> {
  readonly ownerId: string;
}

export type RegisteredUserSelectMenu = RegisteredInteraction;

export class UserSelectMenuRouter extends InteractionRouter<UserSelectMenuInteraction> {
  constructor(logger: Logger) {
    super(logger, "User select menu");
  }

  RegisterUserSelectMenu(
    options: RegisterUserSelectMenuOptions,
  ): RegisteredUserSelectMenu {
    return this.Register(options);
  }

  HandleUserSelectMenu(
    interaction: UserSelectMenuInteraction,
  ): Promise<boolean> {
    return this.Handle(interaction);
  }

  CleanupExpiredMenus(): void {
    this.CleanupExpired();
  }

  GetMenuCount(): number {
    return this.Size;
  }
}

export function CreateUserSelectMenuRouter(
  logger: Logger,
): UserSelectMenuRouter {
  return new UserSelectMenuRouter(logger);
}
