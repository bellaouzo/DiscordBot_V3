import type {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import type { CommandExecutor } from "./CommandFactory";
import type { CommandConfig } from "@middleware/CommandConfig";

/**
 * One subcommand: its slash definition and the handler that runs it, side by side.
 */
export interface SubcommandDefinition {
  readonly name: string;
  readonly description: string;
  /** Adds the subcommand's options. */
  readonly options?: (sub: SlashCommandSubcommandBuilder) => void;
  readonly execute: CommandExecutor;
  /** Overrides the command's config for this subcommand only, field by field. */
  readonly config?: CommandConfig;
  /**
   * Also register this subcommand as a top-level shortcut command: `true` uses the subcommand
   * name (`/economy daily` → `/daily`), a string picks the shortcut's name.
   */
  readonly alias?: true | string;
}

/**
 * A subcommand group, e.g. `/economy market buy`.
 */
export interface SubcommandGroupDefinition {
  readonly name: string;
  readonly description: string;
  readonly subcommands: readonly SubcommandDefinition[];
}

export type SubcommandEntry = SubcommandDefinition | SubcommandGroupDefinition;

function IsGroup(entry: SubcommandEntry): entry is SubcommandGroupDefinition {
  return "subcommands" in entry;
}

/**
 * Registers subcommands and groups on a builder, in the order given.
 */
export function AddSubcommands(
  builder: SlashCommandBuilder,
  entries: readonly SubcommandEntry[],
): void {
  for (const entry of entries) {
    if (IsGroup(entry)) {
      builder.addSubcommandGroup((group) => {
        group.setName(entry.name).setDescription(entry.description);
        for (const sub of entry.subcommands) {
          group.addSubcommand((builderSub) =>
            ConfigureSubcommand(builderSub, sub),
          );
        }
        return group;
      });
    } else {
      builder.addSubcommand((builderSub) =>
        ConfigureSubcommand(builderSub, entry),
      );
    }
  }
}

function ConfigureSubcommand(
  builder: SlashCommandSubcommandBuilder,
  definition: SubcommandDefinition,
): SlashCommandSubcommandBuilder {
  builder.setName(definition.name).setDescription(definition.description);
  definition.options?.(builder);
  return builder;
}

/**
 * Builds an executor that dispatches to the matching subcommand's handler.
 */
export function RouteSubcommands(
  entries: readonly SubcommandEntry[],
): CommandExecutor {
  const routes = new Map<string, CommandExecutor>();
  for (const entry of entries) {
    if (IsGroup(entry)) {
      for (const sub of entry.subcommands) {
        routes.set(`${entry.name} ${sub.name}`, sub.execute);
      }
    } else {
      routes.set(entry.name, entry.execute);
    }
  }

  return async (interaction, context) => {
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(true);
    const execute = routes.get(group ? `${group} ${subcommand}` : subcommand);

    if (!execute) {
      context.logger.Warn("No handler for subcommand", {
        extra: { group, subcommand },
      });
      return;
    }

    await execute(interaction, context);
  };
}

/** One subcommand with its full path, e.g. "daily" or "market buy". */
export interface SubcommandWithPath {
  readonly path: string;
  readonly definition: SubcommandDefinition;
}

/**
 * Flattens subcommands and groups into their full paths.
 */
export function ListSubcommands(
  entries: readonly SubcommandEntry[],
): SubcommandWithPath[] {
  return entries.flatMap((entry) =>
    IsGroup(entry)
      ? entry.subcommands.map((definition) => ({
          path: `${entry.name} ${definition.name}`,
          definition,
        }))
      : [{ path: entry.name, definition: entry }],
  );
}
