import { SlashCommandBuilder } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { CommandDefinition, RegisterCommand } from "@commands";
import { Logger } from "@shared/Logger";

export interface CommandLoaderResult {
  readonly commands: SlashCommandBuilder[];
  readonly modules: Map<string, CommandDefinition>;
}

export type CommandLoader = () => Promise<CommandLoaderResult>;

export function CreateCommandLoader(logger: Logger): CommandLoader {
  return async () => {
    const commands: SlashCommandBuilder[] = [];
    const commandModules = new Map<string, CommandDefinition>();

    const commandsPath = join(__dirname, "..", "Commands");

    const isCommandFile = (file: string): boolean => {
      if (typeof file !== "string") return false;
      if (!/Command\.(js|ts)$/.test(file)) return false;
      if (file.endsWith(".d.ts")) return false;
      if (
        file.includes("CommandFactory.") ||
        file.includes("CommandOptions.")
      ) {
        return false;
      }
      if (file.includes("registry.") || file.includes("index.")) {
        return false;
      }
      return true;
    };

    const files = readdirSync(commandsPath, { recursive: true }).filter(
      (file) => isCommandFile(file as string)
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
            "group" in exp
        ) as CommandDefinition[];

        for (const command of commandExports) {
          commands.push(command.data);
          commandModules.set(command.data.name, command);
          RegisterCommand(command);
        }
      } catch (error) {
        logger.Error("Failed to load command file", {
          file: String(file),
          error,
        });
      }
    }

    logger.Debug("Loaded all commands", {
      timestamp: new Date().toISOString(),
      extra: {
        command_count: commands.length,
      },
    });

    return { commands, modules: commandModules };
  };
}
