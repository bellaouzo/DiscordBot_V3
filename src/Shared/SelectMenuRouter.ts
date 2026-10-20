import type { StringSelectMenuInteraction } from "discord.js";
import type { Logger } from "./Logger";
import type {
  InteractionHandler,
  RegisterInteractionOptions,
  RegisteredInteraction,
} from "./InteractionRouter";
import { InteractionRouter } from "./InteractionRouter";

export type SelectMenuHandler = InteractionHandler<StringSelectMenuInteraction>;

export type RegisterSelectMenuOptions =
  RegisterInteractionOptions<StringSelectMenuInteraction>;

export type RegisteredSelectMenu = RegisteredInteraction;

export class SelectMenuRouter extends InteractionRouter<StringSelectMenuInteraction> {
  constructor(logger: Logger) {
    super(logger, "Select menu");
  }

  RegisterSelectMenu(options: RegisterSelectMenuOptions): RegisteredSelectMenu {
    return this.Register(options);
  }

  HandleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
    return this.Handle(interaction);
  }
}

export function CreateSelectMenuRouter(logger: Logger): SelectMenuRouter {
  return new SelectMenuRouter(logger);
}
