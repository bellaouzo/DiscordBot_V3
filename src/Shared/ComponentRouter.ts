import type { ButtonInteraction } from "discord.js";
import type { Logger } from "./Logger";
import type {
  InteractionHandler,
  RegisterInteractionOptions,
  RegisteredInteraction,
} from "./InteractionRouter";
import { InteractionRouter } from "./InteractionRouter";

export type ButtonHandler = InteractionHandler<ButtonInteraction>;

export interface RegisterButtonOptions extends RegisterInteractionOptions<ButtonInteraction> {
  readonly prefix?: string;
}

export type RegisteredButton = RegisteredInteraction;

export class ComponentRouter extends InteractionRouter<ButtonInteraction> {
  constructor(logger: Logger) {
    super(logger, "Button");
  }

  RegisterButton(options: RegisterButtonOptions): RegisteredButton {
    if (options.prefix) {
      return this.RegisterButtonPrefix(options.prefix, options);
    }
    return this.Register(options);
  }

  RegisterButtonPrefix(
    prefix: string,
    options: Omit<RegisterButtonOptions, "customId" | "prefix">,
  ): RegisteredButton {
    return this.RegisterPrefix(prefix, options);
  }

  HandleButton(interaction: ButtonInteraction): Promise<boolean> {
    return this.Handle(interaction);
  }
}

export function CreateComponentRouter(logger: Logger): ComponentRouter {
  return new ComponentRouter(logger);
}
