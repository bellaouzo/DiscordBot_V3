import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

export interface DiscordConfig {
  readonly token: string;
}

export interface DeploymentConfig {
  readonly clientId: string;
  readonly guildId: string;
}

export interface LoggingConfig {
  readonly commandLogChannelName: string;
  readonly commandLogCategoryName: string;
}

export interface AppConfig {
  readonly discord: DiscordConfig;
  readonly deployment: DeploymentConfig;
  readonly logging: LoggingConfig;
}

const ENVIRONMENT_PATHS = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../src/.env"),
];

function ResolveEnvironmentPath(): string | undefined {
  for (const candidate of ENVIRONMENT_PATHS) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function InitializeEnvironment(): void {
  const explicitPath = process.env.APP_ENV_PATH;
  if (explicitPath) {
    loadEnv({ path: explicitPath, override: false });
    return;
  }

  const detectedPath = ResolveEnvironmentPath();
  if (detectedPath) {
    loadEnv({ path: detectedPath, override: false });
    return;
  }

  loadEnv({ override: false });
}

function RequireEnv(variableName: string): string {
  const value = process.env[variableName];
  if (!value || value.trim().length === 0) {
    throw new Error(`Environment variable ${variableName} is required`);
  }
  return value;
}

export function LoadAppConfig(): AppConfig {
  InitializeEnvironment();

  return {
    discord: {
      token: RequireEnv("DISCORD_TOKEN"),
    },
    deployment: {
      clientId: RequireEnv("CLIENT_ID"),
      guildId: RequireEnv("GUILD_ID"),
    },
    logging: {
      commandLogChannelName:
        process.env.COMMAND_LOG_CHANNEL_NAME || "command-logs",
      commandLogCategoryName:
        process.env.COMMAND_LOG_CATEGORY_NAME || "Bot Logs",
    },
  };
}
