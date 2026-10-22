import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandDefinition } from "@commands";
import type { Logger } from "@shared/Logger";
import type { ResponderSet } from "@responders";
import type { CommandConfig } from "@middleware/CommandConfig";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { GuildMiddleware } from "@middleware/GuildMiddleware";
import { FeatureEnabledMiddleware } from "@middleware/FeatureEnabledMiddleware";
import { BotPermissionMiddleware } from "@middleware/BotPermissionMiddleware";
import { AutoDeferMiddleware } from "@middleware/AutoDeferMiddleware";

/**
 * Mutable bookkeeping for one command run, filled in by RunMiddlewareChain.
 */
export interface MiddlewareRunState {
  /** Date.now() when the chain started; deadlines like auto-defer are measured from here. */
  readonly startedAt: number;
  /** True once every middleware called next() and the command handler started. */
  reachedHandler: boolean;
  /** Name of the middleware that stopped the chain without calling next(). */
  blockedBy?: string;
}

/**
 * Context passed to middleware: interaction, command, logger, responders, config, databases, appConfig, run state.
 */
export interface MiddlewareContext {
  readonly interaction: ChatInputCommandInteraction;
  readonly command: CommandDefinition;
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly config: CommandConfig;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
  readonly run: MiddlewareRunState;
}

/**
 * Creates fresh run state for one command invocation.
 */
export function CreateRunState(now = Date.now()): MiddlewareRunState {
  return { startedAt: now, reachedHandler: false };
}

/**
 * Middleware unit: name and execute(context, next). Call next() to continue the chain.
 */
export interface CommandMiddleware {
  readonly name: string;
  readonly execute: (
    context: MiddlewareContext,
    next: () => Promise<void>,
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
  finalHandler: () => Promise<void>,
): Promise<void> {
  let index = -1;

  const dispatch = async (i: number): Promise<void> => {
    if (i <= index) {
      throw new Error("next() called multiple times");
    }

    index = i;
    const current = middleware[i];

    if (!current) {
      context.run.reachedHandler = true;
      await finalHandler();
      return;
    }

    await current.execute(context, () => dispatch(i + 1));

    if (index === i && !context.run.blockedBy) {
      context.run.blockedBy = current.name;
    }
  };

  await dispatch(0);
}

export { LoggingMiddleware } from "@middleware/LoggingMiddleware";
export { PermissionMiddleware } from "@middleware/PermissionMiddleware";
export { ErrorMiddleware } from "@middleware/ErrorMiddleware";
export { CooldownMiddleware } from "@middleware/CooldownMiddleware";
export { GuildMiddleware } from "@middleware/GuildMiddleware";
export { CommandEnabledMiddleware } from "@middleware/CommandEnabledMiddleware";
export { FeatureEnabledMiddleware } from "@middleware/FeatureEnabledMiddleware";
export {
  IsProtectedCommand,
  PROTECTED_COMMANDS,
} from "@middleware/ProtectedCommands";
export { DiscordLoggingMiddleware } from "@middleware/DiscordLoggingMiddleware";
export { BlocklistMiddleware } from "@middleware/BlocklistMiddleware";
export { ChannelRestrictionMiddleware } from "@middleware/ChannelRestrictionMiddleware";
export { BotPermissionMiddleware } from "@middleware/BotPermissionMiddleware";
export { AutoDeferMiddleware } from "@middleware/AutoDeferMiddleware";
export * from "@middleware/CommandConfig";

/**
 * Builds the per-command middleware from config. Global middleware (error handling, blocklist,
 * logging, command toggles, channel restrictions, Discord command logs) is added by the
 * executor for every command, so it is not part of this list.
 *
 * Order: GuildOnly, Feature, Permission, BotPermission, Cooldown, AutoDefer. Cheap rejections
 * run first; the cooldown is reserved last so a blocked command doesn't use it up.
 *
 * @param config - Optional command config
 * @returns before and after middleware arrays
 */
export function AutoMiddleware(
  config?: CommandConfig,
): MiddlewareConfiguration {
  const before: CommandMiddleware[] = [];

  if (!config) {
    return { before, after: [] };
  }

  if (config.guildOnly) {
    before.push(GuildMiddleware);
  }

  if (config.requiredFeature) {
    before.push(FeatureEnabledMiddleware);
  }

  const needsPermissionCheck =
    config.permissions?.required?.length ||
    config.modRole ||
    config.adminRole ||
    config.owner ||
    config.botOwner ||
    config.role;

  if (needsPermissionCheck) {
    before.push(PermissionMiddleware);
  }

  if (config.botPermissions?.required.length) {
    before.push(BotPermissionMiddleware);
  }

  if (config.cooldown) {
    before.push(CooldownMiddleware);
  }

  if (config.autoDefer) {
    before.push(AutoDeferMiddleware);
  }

  return { before, after: [] };
}
