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

function ResolveDeployRoute(deployment: DeploymentConfig): string {
  if (deployment.deployScope === "guild") {
    if (!deployment.guildId) {
      throw new Error("guildId is required when deployScope is guild");
    }
    return Routes.applicationGuildCommands(
      deployment.clientId,
      deployment.guildId,
    );
  }

  return Routes.applicationCommands(deployment.clientId);
}

function ResolveOppositeDeployRoute(
  deployment: DeploymentConfig,
): string | null {
  if (deployment.deployScope === "guild") {
    return Routes.applicationCommands(deployment.clientId);
  }

  if (!deployment.guildId) {
    return null;
  }

  return Routes.applicationGuildCommands(
    deployment.clientId,
    deployment.guildId,
  );
}

export function CreateCommandDeployer(
  options: CommandDeployerOptions,
): CommandDeployer {
  return async (commands: SlashCommandBuilder[]) => {
    const rest = new REST().setToken(options.token);
    const route = ResolveDeployRoute(options.deployment);
    const oppositeRoute = ResolveOppositeDeployRoute(options.deployment);

    options.logger.Info("Deploying slash commands", {
      extra: {
        deployScope: options.deployment.deployScope,
        guildId: options.deployment.guildId ?? null,
        commandCount: commands.length,
        clearingOppositeScope: oppositeRoute !== null,
      },
    });

    try {
      await rest.put(route as `/${string}`, { body: commands });

      if (oppositeRoute) {
        await rest.put(oppositeRoute as `/${string}`, { body: [] });
      }
    } catch (error) {
      options.logger.Error("Failed to deploy commands", { error });
    }
  };
}
