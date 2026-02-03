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

/**
 * Context passed to middleware: interaction, command, logger, responders, config, databases, appConfig.
 */
export interface MiddlewareContext {
  readonly interaction: ChatInputCommandInteraction;
  readonly command: CommandDefinition;
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly config: CommandConfig;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

/**
 * Middleware unit: name and execute(context, next). Call next() to continue the chain.
 */
export interface CommandMiddleware {
  readonly name: string;
  readonly execute: (
    context: MiddlewareContext,
    next: () => Promise<void>
  ) => Promise<void>;
}

/**
 * Optional before/after middleware arrays for a command.
 */
export interface MiddlewareConfiguration {
  readonly before?: CommandMiddleware[];
  readonly after?: CommandMiddleware[];
}

/**
 * Runs the middleware array then the final handler. Each middleware receives context and next.
 *
 * @param middleware - Ordered list of middleware
 * @param context - Shared context
 * @param finalHandler - Called after all middleware invoke next()
 */
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

/**
 * Builds default before/after middleware from config: Logging, optional GuildOnly/Permission/Cooldown, Error.
 * Used by CreateCommand when command middleware is not provided.
 *
 * @param config - Optional command config; guildOnly, permissions, modRole, owner, role, cooldown drive which middleware are added
 * @returns before and after middleware arrays
 */
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
