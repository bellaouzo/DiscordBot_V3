import type {
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { CommandDefinition, ContextMenuDefinition } from "@commands";
import {
  IsContextMenuDefinition,
  MAX_CONTEXT_MENUS_PER_TYPE,
} from "@commands/ContextMenuFactory";
import type { Logger } from "@shared/Logger";
import { LoadModule, ResolveModulePath } from "./LoadModule";

export interface LoadError {
  readonly file: string;
  readonly error: unknown;
}

/** Discord's limit on top-level slash commands per app. */
export const MAX_SLASH_COMMANDS = 100;

export interface LoadedCommands {
  /** Slash commands, including shortcut aliases. */
  readonly definitions: CommandDefinition[];
  /** Right-click menus on users and messages. */
  readonly contextMenus: ContextMenuDefinition[];
  /** Everything to deploy to Discord: slash commands, aliases and menus. */
  readonly slashData: (SlashCommandBuilder | ContextMenuCommandBuilder)[];
  readonly errors: readonly LoadError[];
}

export type CommandLoader = () => Promise<LoadedCommands>;

function isReExportOnlyBarrel(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  if (content.includes("CreateCommand(")) {
    return false;
  }
  return /export\s+\{[^}]+\}\s+from\s+["']/.test(content);
}

function isCommandFile(file: string, commandsPath: string): boolean {
  if (typeof file !== "string") return false;
  if (!/Command\.(js|ts)$/.test(file)) return false;
  if (file.endsWith(".d.ts")) return false;
  if (file.includes("CommandFactory.") || file.includes("CommandOptions.")) {
    return false;
  }
  if (file.includes("registry.") || file.includes("index.")) {
    return false;
  }

  const filePath = ResolveModulePath(commandsPath, file);
  if (isReExportOnlyBarrel(filePath)) {
    return false;
  }

  return true;
}

interface LoadedCommandEntry {
  readonly command: CommandDefinition;
  readonly file: string;
}

function AssertContextMenus(menus: ContextMenuDefinition[]): void {
  for (const kind of ["user", "message"] as const) {
    const names = menus
      .filter((menu) => menu.kind === kind)
      .map((menu) => menu.data.name);
    if (names.length > MAX_CONTEXT_MENUS_PER_TYPE) {
      throw new Error(
        `Discord allows ${MAX_CONTEXT_MENUS_PER_TYPE} ${kind} context menus; found ${names.length}: ${names.join(", ")}`,
      );
    }
    const duplicate = names.find((name, i) => names.indexOf(name) !== i);
    if (duplicate) {
      throw new Error(`Duplicate ${kind} context menu "${duplicate}"`);
    }
  }
}

function AssertNoDuplicateCommandNames(entries: LoadedCommandEntry[]): void {
  const seen = new Map<string, string>();

  for (const entry of entries) {
    const name = entry.command.data.name;
    const previous = seen.get(name);
    if (previous) {
      throw new Error(
        `Duplicate command name "${name}" loaded from ${previous} and ${entry.file}`,
      );
    }
    seen.set(name, entry.file);
  }
}

function ThrowIfLoadFailed(errors: LoadError[]): void {
  if (errors.length === 0) {
    return;
  }

  const summary = errors
    .map((entry) => `- ${entry.file}: ${String(entry.error)}`)
    .join("\n");

  throw new Error(
    `Failed to load ${errors.length} command file(s):\n${summary}`,
  );
}

export function CreateCommandLoader(logger: Logger): CommandLoader {
  return async () => {
    const entries: LoadedCommandEntry[] = [];
    const contextMenus: ContextMenuDefinition[] = [];
    const errors: LoadError[] = [];
    const commandsPath = join(__dirname, "..", "Commands");

    const files = readdirSync(commandsPath, { recursive: true }).filter(
      (file) => isCommandFile(file as string, commandsPath),
    );

    for (const file of files) {
      const filePath = ResolveModulePath(commandsPath, file as string);
      const fileLabel = String(file);
      try {
        const module = await LoadModule(filePath);

        const exports = Object.values(module);
        contextMenus.push(...exports.filter(IsContextMenuDefinition));

        const commandExports = exports.filter(
          (exp) =>
            exp &&
            typeof exp === "object" &&
            "data" in exp &&
            "execute" in exp &&
            "group" in exp &&
            !IsContextMenuDefinition(exp),
        ) as CommandDefinition[];

        for (const command of commandExports) {
          for (const definition of [command, ...(command.aliases ?? [])]) {
            entries.push({ command: definition, file: fileLabel });
          }
        }
      } catch (error) {
        logger.Error("Failed to load command file", {
          file: fileLabel,
          error,
        });
        errors.push({ file: fileLabel, error });
      }
    }

    ThrowIfLoadFailed(errors);

    if (entries.length === 0) {
      throw new Error("No commands were loaded from the Commands directory");
    }

    AssertNoDuplicateCommandNames(entries);
    AssertContextMenus(contextMenus);

    if (entries.length > MAX_SLASH_COMMANDS) {
      throw new Error(
        `Discord allows ${MAX_SLASH_COMMANDS} slash commands; found ${entries.length} (including shortcut aliases)`,
      );
    }

    const definitions = entries.map((entry) => entry.command);
    const slashData = [
      ...definitions.map((command) => command.data),
      ...contextMenus.map((menu) => menu.data),
    ];

    logger.Debug("Loaded all commands", {
      timestamp: new Date().toISOString(),
      extra: {
        command_count: definitions.length,
        context_menu_count: contextMenus.length,
      },
    });

    return { definitions, contextMenus, slashData, errors };
  };
}
