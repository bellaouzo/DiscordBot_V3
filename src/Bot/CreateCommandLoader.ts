import { SlashCommandBuilder } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { CommandDefinition } from "@commands";
import { Logger } from "@shared/Logger";

export interface LoadedCommands {
  readonly definitions: CommandDefinition[];
  readonly slashData: SlashCommandBuilder[];
}

export type CommandLoader = () => Promise<LoadedCommands>;

export function CreateCommandLoader(logger: Logger): CommandLoader {
  return async () => {
    const definitions: CommandDefinition[] = [];
    const slashData: SlashCommandBuilder[] = [];
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
      }
    }

    logger.Debug("Loaded all commands", {
      timestamp: new Date().toISOString(),
      extra: {
          command_count: definitions.length,
      },
    });

    return { definitions, slashData };
  };
}
