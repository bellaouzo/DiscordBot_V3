import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from "discord.js";
import type {
  CommandDefinition,
  CommandContext,
  ContextMenuDefinition,
} from "@commands";
import type { Logger } from "@shared/Logger";
import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";
import type {
  CommandInteractionLike,
  CommandInvocation,
  CommandMiddleware,
  MiddlewareConfiguration,
  MiddlewareContext,
  ResolvedCommandConfig,
} from "@middleware";
import {
  AutoMiddleware,
  BlocklistMiddleware,
  ChannelRestrictionMiddleware,
  CommandEnabledMiddleware,
  CreateRunState,
  DiscordLoggingMiddleware,
  ErrorMiddleware,
  LoggingMiddleware,
  ResolveConfig,
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
 * Runs a slash command: resolves its config, runs the middleware chain, then command.execute.
 */
export type CommandExecutor = (
  command: CommandDefinition,
  interaction: ChatInputCommandInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

/**
 * Runs a right-click menu through the same middleware chain as slash commands.
 */
export type ContextMenuExecutor = (
  menu: ContextMenuDefinition,
  interaction: ContextMenuCommandInteraction,
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
 * Builds the full chain: global before, the command's middleware (from config, or its custom
 * `middleware` minus any globals it lists again), then global after.
 */
export function BuildMiddlewareChain(
  config: ResolvedCommandConfig,
  custom?: MiddlewareConfiguration,
): CommandMiddleware[] {
  const own = custom
    ? [...(custom.before ?? []), ...(custom.after ?? [])].filter(
        (middleware) => !GLOBAL_NAMES.has(middleware.name),
      )
    : AutoMiddleware(config);

  return [...GLOBAL_BEFORE, ...own, ...GLOBAL_AFTER];
}

/**
 * Works out which command and subcommand an interaction runs and the config that applies.
 * Shortcut aliases resolve to the command and subcommand they belong to.
 */
export function ResolveInvocation(
  command: CommandDefinition,
  interaction: ChatInputCommandInteraction,
): { invocation: CommandInvocation; config: ResolvedCommandConfig } {
  const commandName = command.aliasOf?.command ?? command.data.name;
  const subcommand =
    command.aliasOf?.subcommand ?? ReadSubcommandPath(interaction);
  const override = subcommand
    ? command.subcommandConfig?.[subcommand]
    : undefined;
  const path = subcommand ? `${commandName} ${subcommand}` : commandName;

  return {
    invocation: {
      commandName,
      group: command.group,
      path,
      // A subcommand with its own cooldown gets its own key; otherwise the command shares one.
      cooldownKey: override?.cooldown !== undefined ? path : commandName,
    },
    config: ResolveConfig(command.config, override),
  };
}

function ReadSubcommandPath(
  interaction: ChatInputCommandInteraction,
): string | undefined {
  const subcommand = interaction.options.getSubcommand(false);
  if (!subcommand) {
    return undefined;
  }
  const group = interaction.options.getSubcommandGroup(false);
  return group ? `${group} ${subcommand}` : subcommand;
}

/**
 * Invocation and config for a right-click menu: it shares its linked command's toggles,
 * channel restrictions and cooldown.
 */
export function ResolveContextMenuInvocation(menu: ContextMenuDefinition): {
  invocation: CommandInvocation;
  config: ResolvedCommandConfig;
} {
  const { command, subcommand } = menu.linked;
  const ownCooldown = menu.config.cooldown !== undefined && subcommand;
  return {
    invocation: {
      commandName: command,
      group: menu.group,
      path: `${menu.data.name} (${menu.kind} menu)`,
      cooldownKey: ownCooldown ? `${command} ${subcommand}` : command,
    },
    config: ResolveConfig(menu.config),
  };
}

interface RunOptions {
  readonly interaction: CommandInteractionLike;
  readonly invocation: CommandInvocation;
  readonly config: ResolvedCommandConfig;
  readonly custom?: MiddlewareConfiguration;
  readonly responders: ResponderSet;
  readonly logger: Logger;
  readonly deps: CommandExecutorDependencies;
  readonly handler: (context: CommandContext) => Promise<void>;
}

async function RunWithMiddleware(options: RunOptions): Promise<void> {
  const context: MiddlewareContext = {
    interaction: options.interaction,
    invocation: options.invocation,
    logger: options.logger,
    responders: options.responders,
    config: options.config,
    databases: options.deps.databases,
    appConfig: options.deps.appConfig,
    run: CreateRunState(),
  };

  const commandContext: CommandContext = {
    responders: options.responders,
    logger: options.logger,
    databases: options.deps.databases,
    appConfig: options.deps.appConfig,
  };

  await RunMiddlewareChain(
    BuildMiddlewareChain(options.config, options.custom),
    context,
    () => options.handler(commandContext),
  );
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
  return async (command, interaction, responders, commandLogger) => {
    const { invocation, config } = ResolveInvocation(command, interaction);
    await RunWithMiddleware({
      interaction,
      invocation,
      config,
      custom: command.middleware,
      responders,
      logger: commandLogger,
      deps,
      handler: (context) => command.execute(interaction, context),
    });
  };
}

/**
 * Creates the executor for right-click menus.
 */
export function CreateContextMenuExecutor(
  deps: CommandExecutorDependencies,
): ContextMenuExecutor {
  return async (menu, interaction, responders, commandLogger) => {
    const { invocation, config } = ResolveContextMenuInvocation(menu);
    await RunWithMiddleware({
      interaction,
      invocation,
      config,
      responders,
      logger: commandLogger,
      deps,
      handler: async (context) => {
        if (menu.kind === "user" && interaction.isUserContextMenuCommand()) {
          await menu.execute(interaction, context);
        } else if (
          menu.kind === "message" &&
          interaction.isMessageContextMenuCommand()
        ) {
          await menu.execute(interaction, context);
        }
      },
    });
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
