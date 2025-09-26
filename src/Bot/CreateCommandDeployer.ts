import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import { Logger } from '../Shared/Logger'
import { DeploymentConfig } from '../Config/AppConfig'

export type CommandDeployer = (commands: SlashCommandBuilder[]) => Promise<void>

export interface CommandDeployerOptions {
  readonly deployment: DeploymentConfig
  readonly token: string
  readonly logger: Logger
}

export function CreateCommandDeployer(options: CommandDeployerOptions): CommandDeployer {
  return async (commands: SlashCommandBuilder[]) => {
    const rest = new REST().setToken(options.token)

    options.logger.Info('Started refreshing application (/) commands.')

    try {
      await rest.put(
        Routes.applicationGuildCommands(options.deployment.clientId, options.deployment.guildId),
        { body: commands }
      )
      options.logger.Info('Successfully reloaded application (/) commands.')
    } catch (error) {
      options.logger.Error('Failed to deploy commands', { error })
    }
  }
}

