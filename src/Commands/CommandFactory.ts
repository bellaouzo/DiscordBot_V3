import type { ChatInputCommandInteraction } from "discord.js";
import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
} from "discord.js";

export {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
};
import type { AppConfig } from "@config/AppConfig";
import type { DatabaseSet } from "@database";
import type { MiddlewareConfiguration } from "@middleware";
import { AutoMiddleware } from "@middleware";
import type { CommandConfig } from "@middleware/CommandConfig";
import type { ResponderSet } from "@responders";
import type { Logger } from "@shared/Logger";

/**
 * Context passed to command execute functions: responders, logger, databases, app config.
 */
export interface CommandContext {
  readonly responders: ResponderSet;
  readonly logger: Logger;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

/**
 * Function that runs when a slash command is invoked. Receives the interaction and context.
 */
export type CommandExecutor = (
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
) => Promise<void>;

/**
 * Registered command: slash builder data, group, execute function, and optional middleware/config.
 */
export interface CommandDefinition {
  readonly data: SlashCommandBuilder;
  readonly group: string;
  readonly execute: CommandExecutor;
  readonly middleware?: MiddlewareConfiguration;
  readonly config?: CommandConfig;
}

/**
 * Options for creating a command. Middleware defaults to AutoMiddleware(config) when omitted.
 */
export interface CommandFactoryOptions {
  readonly name: string;
  readonly description: string;
  readonly group: string;
  readonly configure?: (builder: SlashCommandBuilder) => void;
  readonly execute: CommandExecutor;
  readonly middleware?: MiddlewareConfiguration;
  readonly config?: CommandConfig;
}

/**
 * Creates a slash command definition. Uses AutoMiddleware(options.config) when middleware is not provided.
 *
 * @param options - Name, description, group, optional configure callback, execute, and optional middleware/config
 * @returns Command definition for the registry
 */
export function CreateCommand(
  options: CommandFactoryOptions,
): CommandDefinition {
  const data = new SlashCommandBuilder()
    .setName(options.name)
    .setDescription(options.description);

  if (options.configure) {
    options.configure(data);
  }

  const middleware = options.middleware ?? AutoMiddleware(options.config);

  return {
    data,
    group: options.group,
    execute: options.execute,
    middleware,
    config: options.config,
  };
}
