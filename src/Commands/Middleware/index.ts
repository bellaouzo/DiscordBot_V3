import { ChatInputCommandInteraction } from "discord.js";
import { CommandDefinition } from "@commands/CommandFactory";
import { Logger } from "@shared/Logger";
import { ResponderSet } from "@responders";
import { CommandConfig } from "@middleware/CommandConfig";
import { DatabaseSet } from "@database";
import { AppConfig } from "@config/AppConfig";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { GuildMiddleware } from "@middleware/GuildMiddleware";

export interface MiddlewareContext {
  readonly interaction: ChatInputCommandInteraction;
  readonly command: CommandDefinition;
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly config: CommandConfig;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
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

export { LoggingMiddleware } from "@middleware/LoggingMiddleware";
export { PermissionMiddleware } from "@middleware/PermissionMiddleware";
export { ErrorMiddleware } from "@middleware/ErrorMiddleware";
export { CooldownMiddleware } from "@middleware/CooldownMiddleware";
export { GuildMiddleware } from "@middleware/GuildMiddleware";
export { DiscordLoggingMiddleware } from "@middleware/DiscordLoggingMiddleware";
export * from "@middleware/CommandConfig";

export function AutoMiddleware(
  config?: CommandConfig
): MiddlewareConfiguration {
  const before: CommandMiddleware[] = [LoggingMiddleware];
  const after: CommandMiddleware[] = [ErrorMiddleware];

  if (config?.guildOnly) {
    before.push(GuildMiddleware);
  }

  if (config) {
    const needsPermissionCheck =
      config.permissions?.required?.length ||
      config.modRole ||
      config.owner ||
      config.role;

    if (needsPermissionCheck) {
      before.push(PermissionMiddleware);
    }

    if (config.cooldown) {
      before.push(CooldownMiddleware);
    }
  }

  return { before, after };
}
