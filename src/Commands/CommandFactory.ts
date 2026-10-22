import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import {
  ApplicationCommandOptionType,
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
import type { CommandConfig } from "@middleware/CommandConfig";
import type { ResponderSet } from "@responders";
import type { Logger } from "@shared/Logger";
import type { SubcommandEntry } from "./Subcommands";
import {
  AddSubcommands,
  ListSubcommands,
  RouteSubcommands,
} from "./Subcommands";

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
 * Answers autocomplete requests for options declared with `.setAutocomplete(true)`.
 */
export type CommandAutocompleteHandler = (
  interaction: AutocompleteInteraction,
  context: CommandContext,
) => Promise<void>;

/**
 * Registered slash command: builder data, group, execute function, config, and any shortcut
 * aliases generated from its subcommands.
 */
export interface CommandDefinition {
  readonly data: SlashCommandBuilder;
  readonly group: string;
  readonly execute: CommandExecutor;
  readonly autocomplete?: CommandAutocompleteHandler;
  /** Replaces the config-driven middleware. Global middleware still runs. */
  readonly middleware?: MiddlewareConfiguration;
  readonly config?: CommandConfig;
  /** Config overrides by subcommand path, e.g. `{ status: {...}, "market buy": {...} }`. */
  readonly subcommandConfig?: Readonly<Record<string, CommandConfig>>;
  /** Set on shortcut commands: the command and subcommand path they run. */
  readonly aliasOf?: { readonly command: string; readonly subcommand: string };
  /** Shortcut commands generated from subcommands marked `alias`. */
  readonly aliases?: readonly CommandDefinition[];
}

interface CommandFactoryBaseOptions {
  readonly name: string;
  readonly description: string;
  readonly group: string;
  /** Extra builder setup (options, permissions). Runs after subcommands are added. */
  readonly configure?: (builder: SlashCommandBuilder) => void;
  readonly autocomplete?: CommandAutocompleteHandler;
  /** Replaces the config-driven middleware. Rarely needed. */
  readonly middleware?: MiddlewareConfiguration;
  /** How the command is gated and run, e.g. `{ access: "mod", cooldown: "5s" }`. */
  readonly config?: CommandConfig;
  /**
   * Per-subcommand config overrides for commands that add subcommands in `configure`, keyed by
   * path (`"status"`, `"config add"`). Table-style subcommands set `config` on the entry instead.
   * Unknown paths throw at startup.
   */
  readonly subcommandConfig?: Readonly<Record<string, CommandConfig>>;
}

/**
 * Options for creating a command. Pass either `execute`, or `subcommands` to have the slash
 * definition and the dispatch generated from one table.
 */
export type CommandFactoryOptions = CommandFactoryBaseOptions &
  (
    | { readonly execute: CommandExecutor; readonly subcommands?: never }
    | {
        readonly subcommands: readonly SubcommandEntry[];
        readonly execute?: never;
      }
  );

/**
 * Lists every subcommand path ("status", "config add") defined on a builder.
 */
export function ListSubcommandPaths(data: SlashCommandBuilder): string[] {
  const paths: string[] = [];
  for (const option of data.toJSON().options ?? []) {
    if (option.type === ApplicationCommandOptionType.Subcommand) {
      paths.push(option.name);
    }
    if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
      for (const sub of option.options ?? []) {
        paths.push(`${option.name} ${sub.name}`);
      }
    }
  }
  return paths;
}

function CollectSubcommandConfig(
  options: CommandFactoryOptions,
  data: SlashCommandBuilder,
): Record<string, CommandConfig> | undefined {
  const collected: Record<string, CommandConfig> = {
    ...options.subcommandConfig,
  };
  for (const { path, definition } of ListSubcommands(
    options.subcommands ?? [],
  )) {
    if (definition.config) {
      collected[path] = definition.config;
    }
  }

  const known = new Set(ListSubcommandPaths(data));
  for (const path of Object.keys(collected)) {
    if (!known.has(path)) {
      throw new Error(
        `/${options.name}: subcommandConfig has "${path}", which is not a subcommand (known: ${[
          ...known,
        ].join(", ")})`,
      );
    }
  }

  return Object.keys(collected).length > 0 ? collected : undefined;
}

function CreateAliases(
  options: CommandFactoryOptions,
  parent: Omit<CommandDefinition, "aliases">,
): CommandDefinition[] {
  return ListSubcommands(options.subcommands ?? [])
    .filter(({ definition }) => definition.alias)
    .map(({ path, definition }) => {
      const name =
        definition.alias === true ? definition.name : String(definition.alias);
      const data = new SlashCommandBuilder()
        .setName(name)
        .setDescription(definition.description);

      // Build the subcommand's options on a scratch builder, then copy them over.
      const scratch = new SlashCommandSubcommandBuilder();
      definition.options?.(scratch);
      data.options.push(...scratch.options);

      if (parent.data.default_member_permissions !== undefined) {
        data.setDefaultMemberPermissions(
          parent.data.default_member_permissions,
        );
      }

      return {
        data,
        group: parent.group,
        execute: definition.execute,
        autocomplete: parent.autocomplete,
        middleware: parent.middleware,
        config: parent.config,
        subcommandConfig: parent.subcommandConfig,
        aliasOf: { command: options.name, subcommand: path },
      };
    });
}

/**
 * Creates a slash command definition. Subcommands marked `alias` also become top-level
 * shortcut commands, returned in `aliases` and registered by the loader.
 *
 * @example
 * export const BanCommand = CreateCommand({
 *   name: "ban",
 *   description: "Ban a user",
 *   group: "moderation",
 *   config: { access: "mod", cooldown: "5s", botPermissions: ["BanMembers"] },
 *   execute: ExecuteBan,
 * });
 */
export function CreateCommand(
  options: CommandFactoryOptions,
): CommandDefinition {
  const data = new SlashCommandBuilder()
    .setName(options.name)
    .setDescription(options.description);

  if (options.subcommands) {
    AddSubcommands(data, options.subcommands);
  }

  if (options.configure) {
    options.configure(data);
  }

  const command: Omit<CommandDefinition, "aliases"> = {
    data,
    group: options.group,
    execute: options.subcommands
      ? RouteSubcommands(options.subcommands)
      : options.execute,
    autocomplete: options.autocomplete,
    middleware: options.middleware,
    config: options.config,
    subcommandConfig: CollectSubcommandConfig(options, data),
  };

  const aliases = CreateAliases(options, command);
  return aliases.length > 0 ? { ...command, aliases } : command;
}
