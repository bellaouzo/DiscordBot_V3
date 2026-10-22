import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import type { CommandDefinition, CommandContext } from "@commands";
import type { Logger } from "@shared/Logger";
import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";
import type { CommandMiddleware, MiddlewareContext } from "@middleware";
import {
  BlocklistMiddleware,
  ChannelRestrictionMiddleware,
  CommandEnabledMiddleware,
  CreateRunState,
  DiscordLoggingMiddleware,
  ErrorMiddleware,
  LoggingMiddleware,
  RunMiddlewareChain,
} from "@middleware";

/**
 * Dependencies for the command executor: databases and app config.
 */
export interface CommandExecutorDependencies {
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

/**
 * Runs a command: builds middleware context, runs before/after middleware chain, then command.execute.
 */
export type CommandExecutor = (
  command: CommandDefinition,
  interaction: ChatInputCommandInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

/**
 * Middleware every command runs, wrapped around the command's own middleware. ErrorMiddleware is
 * outermost so failures anywhere in the chain get logged and answered.
 */
const GLOBAL_BEFORE: readonly CommandMiddleware[] = [
  ErrorMiddleware,
  BlocklistMiddleware,
  LoggingMiddleware,
  CommandEnabledMiddleware,
  ChannelRestrictionMiddleware,
];

const GLOBAL_AFTER: readonly CommandMiddleware[] = [DiscordLoggingMiddleware];

const GLOBAL_NAMES = new Set(
  [...GLOBAL_BEFORE, ...GLOBAL_AFTER].map((middleware) => middleware.name),
);

/**
 * Builds the full chain for a command: global before, the command's own middleware (minus any
 * globals it lists again), then global after.
 */
export function BuildMiddlewareChain(
  command: CommandDefinition,
): CommandMiddleware[] {
  const own = [
    ...(command.middleware?.before ?? []),
    ...(command.middleware?.after ?? []),
  ].filter((middleware) => !GLOBAL_NAMES.has(middleware.name));

  return [...GLOBAL_BEFORE, ...own, ...GLOBAL_AFTER];
}

/**
 * Creates the executor that runs command middleware then the command handler.
 *
 * @param deps - Databases and app config
 * @returns CommandExecutor function
 */
export function CreateCommandExecutor(
  deps: CommandExecutorDependencies,
): CommandExecutor {
  return async (
    command: CommandDefinition,
    interaction: ChatInputCommandInteraction,
    responders: ResponderSet,
    commandLogger: Logger,
  ): Promise<void> => {
    const context: MiddlewareContext = {
      interaction,
      command,
      logger: commandLogger,
      responders,
      config: command.config ?? {},
      databases: deps.databases,
      appConfig: deps.appConfig,
      run: CreateRunState(),
    };

    const finalHandler = async (): Promise<void> => {
      const commandContext: CommandContext = {
        responders,
        logger: commandLogger,
        databases: deps.databases,
        appConfig: deps.appConfig,
      };
      await command.execute(interaction, commandContext);
    };

    await RunMiddlewareChain(
      BuildMiddlewareChain(command),
      context,
      finalHandler,
    );
  };
}

/**
 * Answers an autocomplete request with the command's autocomplete handler. Middleware is
 * skipped: autocomplete only suggests values, and the command re-checks everything on submit.
 */
export type AutocompleteExecutor = (
  command: CommandDefinition,
  interaction: AutocompleteInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

export function CreateAutocompleteExecutor(
  deps: CommandExecutorDependencies,
): AutocompleteExecutor {
  return async (command, interaction, responders, commandLogger) => {
    if (!command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction, {
        responders,
        logger: commandLogger,
        databases: deps.databases,
        appConfig: deps.appConfig,
      });
    } catch (error) {
      commandLogger.Warn("Autocomplete handler failed", { error });
      if (!interaction.responded) {
        await interaction.respond([]).catch(() => undefined);
      }
    }
  };
}
