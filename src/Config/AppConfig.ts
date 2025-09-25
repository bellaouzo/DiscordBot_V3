import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

export interface DiscordConfig {
  readonly token: string
}

export interface DeploymentConfig {
  readonly clientId: string
  readonly guildId: string
}

export interface AppConfig {
  readonly discord: DiscordConfig
  readonly deployment: DeploymentConfig
}

let envLoaded = false

function _EnsureEnvLoaded(): void {
  if (envLoaded) {
    return
  }

  const candidatePaths: (string | undefined)[] = [
    undefined, // default dotenv resolution relative to process.cwd()
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../src/.env')
  ]

  for (const candidate of candidatePaths) {
    const result = candidate
      ? loadEnv({ path: candidate, override: false })
      : loadEnv({ override: false })

    if (!result.error) {
      envLoaded = true
      return
    }
  }

  envLoaded = true
}

function _RequireEnv(variableName: string): string {
  if (!envLoaded) {
    _EnsureEnvLoaded()
  }
  const value = process.env[variableName]
  if (!value) {
    throw new Error(`Environment variable ${variableName} is required`)
  }
  return value
}

export function LoadAppConfig(): AppConfig {
  return {
    discord: {
      token: _RequireEnv('DISCORD_TOKEN')
    },
    deployment: {
      clientId: _RequireEnv('CLIENT_ID'),
      guildId: _RequireEnv('GUILD_ID')
    }
  }
}

