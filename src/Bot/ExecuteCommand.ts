import { ChatInputCommandInteraction } from "discord.js";
import { CommandDefinition, CommandContext } from "@commands";
import { Logger } from "@shared/Logger";
import { ResponderSet } from "@responders";
import { DatabaseSet } from "@database";
import { AppConfig } from "@config/AppConfig";
import {
  MiddlewareContext,
  RunMiddlewareChain,
  DiscordLoggingMiddleware,
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
  commandLogger: Logger
) => Promise<void>;

/**
 * Creates the executor that runs command middleware then the command handler.
 * After middleware includes DiscordLoggingMiddleware for command logging.
 *
 * @param deps - Databases and app config
 * @returns CommandExecutor function
 */
export function CreateCommandExecutor(
  deps: CommandExecutorDependencies
): CommandExecutor {
  return async (
    command: CommandDefinition,
    interaction: ChatInputCommandInteraction,
    responders: ResponderSet,
    commandLogger: Logger
  ): Promise<void> => {
    const middleware = command.middleware?.before ?? [];
    const afterMiddleware = [
      ...(command.middleware?.after ?? []),
      DiscordLoggingMiddleware,
    ];

    const context: MiddlewareContext = {
      interaction,
      command,
      logger: commandLogger,
      responders,
      config: command.config ?? {},
      databases: deps.databases,
      appConfig: deps.appConfig,
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

    const middlewareChain = [...middleware, ...afterMiddleware];

    await RunMiddlewareChain(middlewareChain, context, finalHandler);
  };
}
