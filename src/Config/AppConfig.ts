import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/** Discord bot token (DISCORD_TOKEN). */
export interface DiscordConfig {
  readonly token: string;
}

/** Application and guild IDs for slash command deployment (CLIENT_ID, GUILD_ID). */
export interface DeploymentConfig {
  readonly clientId: string;
  readonly guildId: string;
}

/** Channel/category names for command logs, delete logs, deploy logs. */
export interface LoggingConfig {
  readonly commandLogChannelName: string;
  readonly commandLogCategoryName: string;
  readonly messageDeleteChannelName: string;
  readonly deployLogChannelName: string;
}

/** API keys (e.g. OPENWEATHER_API_KEY). */
export interface ApiKeysConfig {
  readonly openWeatherMapApiKey: string | null;
}

/** Root app config: discord, deployment, logging, apiKeys. */
export interface AppConfig {
  readonly discord: DiscordConfig;
  readonly deployment: DeploymentConfig;
  readonly logging: LoggingConfig;
  readonly apiKeys: ApiKeysConfig;
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

/**
 * Loads .env (from project root or APP_ENV_PATH), validates required vars, and returns AppConfig.
 * Throws if DISCORD_TOKEN, CLIENT_ID, or GUILD_ID are missing or empty.
 *
 * @returns AppConfig with discord, deployment, logging, apiKeys
 */
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
      messageDeleteChannelName:
        process.env.MESSAGE_DELETE_LOG_CHANNEL_NAME || "deleted-logs",
      deployLogChannelName:
        process.env.DEPLOY_LOG_CHANNEL_NAME || "deployment-logs",
    },
    apiKeys: {
      openWeatherMapApiKey: process.env.OPENWEATHER_API_KEY || null,
    },
  };
}
