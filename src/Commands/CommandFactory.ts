import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { Logger } from '../Shared/Logger'
import { ResponderSet } from '../Responders'
import { MiddlewareConfiguration } from './Middleware'
import { CommandConfig } from './Middleware/CommandConfig'

export interface CommandContext {
  readonly responders: ResponderSet
  readonly logger: Logger
}

export type CommandExecutor = (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>

export interface CommandDefinition {
  readonly data: SlashCommandBuilder
  readonly group: string
  readonly execute: CommandExecutor
  readonly middleware?: MiddlewareConfiguration
  readonly config?: CommandConfig
}

export interface CommandFactoryOptions {
  readonly name: string
  readonly description: string
  readonly group: string
  readonly configure?: (builder: SlashCommandBuilder) => void
  readonly execute: CommandExecutor
  readonly middleware?: MiddlewareConfiguration
  readonly config?: CommandConfig
}

export function CreateCommand(options: CommandFactoryOptions): CommandDefinition {
  const data = new SlashCommandBuilder()
    .setName(options.name)
    .setDescription(options.description)

  if (options.configure) {
    options.configure(data)
  }

  return {
    data,
    group: options.group,
    execute: options.execute,
    middleware: options.middleware,
    config: options.config
  }
}

