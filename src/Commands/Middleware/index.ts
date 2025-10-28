import { ChatInputCommandInteraction } from "discord.js";
import { CommandDefinition } from "../CommandFactory";
import { Logger } from "../../Shared/Logger";
import { ResponderSet } from "../../Responders";
import { CommandConfig } from "./CommandConfig";

export interface MiddlewareContext {
  readonly interaction: ChatInputCommandInteraction;
  readonly command: CommandDefinition;
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly config: CommandConfig;
}

export interface CommandMiddleware {
  readonly name: string;
  readonly execute: (
    context: MiddlewareContext,
    next: () => Promise<void>
  ) => Promise<void>;
}

export interface MiddlewareConfiguration {
  readonly before?: CommandMiddleware[];
  readonly after?: CommandMiddleware[];
}

export async function RunMiddlewareChain(
  middleware: CommandMiddleware[],
  context: MiddlewareContext,
  finalHandler: () => Promise<void>
): Promise<void> {
  let index = -1;

  const dispatch = async (i: number): Promise<void> => {
    if (i <= index) {
      throw new Error("next() called multiple times");
    }

    index = i;
    const current = middleware[i];

    if (!current) {
      await finalHandler();
      return;
    }

    await current.execute(context, () => dispatch(i + 1));
  };

  await dispatch(0);
}

export { LoggingMiddleware } from "./LoggingMiddleware";
export { PermissionMiddleware } from "./PermissionMiddleware";
export { ErrorMiddleware } from "./ErrorMiddleware";
export { CooldownMiddleware } from "./CooldownMiddleware";
