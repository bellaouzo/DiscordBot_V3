import type { SlashCommandBuilder } from "discord.js";
import { REST, Routes } from "discord.js";
import type { Logger } from "@shared/Logger";
import type { DeploymentConfig } from "@config/AppConfig";

export type CommandDeployer = (
  commands: SlashCommandBuilder[],
) => Promise<void>;

export interface CommandDeployerOptions {
  readonly deployment: DeploymentConfig;
  readonly token: string;
  readonly logger: Logger;
}

export function CreateCommandDeployer(
  options: CommandDeployerOptions,
): CommandDeployer {
  return async (commands: SlashCommandBuilder[]) => {
    const rest = new REST().setToken(options.token);

    try {
      await rest.put(
        Routes.applicationGuildCommands(
          options.deployment.clientId,
          options.deployment.guildId,
        ),
        { body: commands },
      );
    } catch (error) {
      options.logger.Error("Failed to deploy commands", { error });
    }
  };
}
