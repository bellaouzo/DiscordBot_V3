import { SlashCommandBuilder } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { CommandDefinition } from "@commands";
import { Logger } from "@shared/Logger";

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

function isCommandFile(file: string): boolean {
  if (typeof file !== "string") return false;
  if (!/Command\.(js|ts)$/.test(file)) return false;
  if (file.endsWith(".d.ts")) return false;
  if (file.includes("CommandFactory.") || file.includes("CommandOptions.")) {
    return false;
  }
  if (file.includes("registry.") || file.includes("index.")) {
    return false;
  }
  return true;
}

function AssertNoDuplicateCommandNames(definitions: CommandDefinition[]): void {
  const seen = new Map<string, string>();

  for (const command of definitions) {
    const name = command.data.name;
    const previous = seen.get(name);
    if (previous) {
      throw new Error(
        `Duplicate command name "${name}" loaded from multiple files`,
      );
    }
    seen.set(name, name);
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
    const definitions: CommandDefinition[] = [];
    const slashData: SlashCommandBuilder[] = [];
    const errors: LoadError[] = [];
    const commandsPath = join(__dirname, "..", "Commands");

    const files = readdirSync(commandsPath, { recursive: true }).filter(
      (file) => isCommandFile(file as string),
    );

    for (const file of files) {
      const filePath = join(commandsPath, file as string);
      try {
        const module = await import(filePath);

        const commandExports = Object.values(module).filter(
          (exp) =>
            exp &&
            typeof exp === "object" &&
            "data" in exp &&
            "execute" in exp &&
            "group" in exp,
        );

        for (const command of commandExports) {
          const cmd = command as CommandDefinition;
          definitions.push(cmd);
          slashData.push(cmd.data);
        }
      } catch (error) {
        logger.Error("Failed to load command file", {
          file: String(file),
          error,
        });
        errors.push({ file: String(file), error });
      }
    }

    ThrowIfLoadFailed(errors);

    if (definitions.length === 0) {
      throw new Error("No commands were loaded from the Commands directory");
    }

    AssertNoDuplicateCommandNames(definitions);

    logger.Debug("Loaded all commands", {
      timestamp: new Date().toISOString(),
      extra: {
        command_count: definitions.length,
      },
    });

    return { definitions, slashData, errors };
  };
}
