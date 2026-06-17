import type { SlashCommandBuilder } from "discord.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { CommandDefinition } from "@commands";
import type { Logger } from "@shared/Logger";
import { LoadModule, ResolveModulePath } from "./LoadModule";

export interface LoadError {
  readonly file: string;
  readonly error: unknown;
}

export interface LoadedCommands {
  readonly definitions: CommandDefinition[];
  readonly slashData: SlashCommandBuilder[];
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

        const commandExports = Object.values(module).filter(
          (exp) =>
            exp &&
            typeof exp === "object" &&
            "data" in exp &&
            "execute" in exp &&
            "group" in exp,
        );

        for (const command of commandExports) {
          entries.push({
            command: command as CommandDefinition,
            file: fileLabel,
          });
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

    const definitions = entries.map((entry) => entry.command);
    const slashData = definitions.map((command) => command.data);

    logger.Debug("Loaded all commands", {
      timestamp: new Date().toISOString(),
      extra: {
        command_count: definitions.length,
      },
    });

    return { definitions, slashData, errors };
  };
}
