import type { ModalSubmitInteraction } from "discord.js";
import type { Logger } from "./Logger";
import type {
  InteractionHandler,
  RegisterInteractionOptions,
  RegisteredInteraction,
} from "./InteractionRouter";
import { InteractionRouter } from "./InteractionRouter";

export type ModalHandler = InteractionHandler<ModalSubmitInteraction>;

export type RegisterModalOptions =
  RegisterInteractionOptions<ModalSubmitInteraction>;

export type RegisteredModal = RegisteredInteraction;

export class ModalRouter extends InteractionRouter<ModalSubmitInteraction> {
  constructor(logger: Logger) {
    super(logger, "Modal");
  }

  RegisterModal(options: RegisterModalOptions): RegisteredModal {
    return this.Register(options);
  }

  HandleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    return this.Handle(interaction);
  }
}

export function CreateModalRouter(logger: Logger): ModalRouter {
  return new ModalRouter(logger);
}
