import { CommandInteraction } from 'discord.js'
import { CreateConsoleLogger, Logger } from '../Logging/Logger'

export interface ResponseOptions {
  readonly content?: string
  readonly ephemeral?: boolean
  readonly components?: any[]
  readonly embeds?: any[]
  readonly files?: any[]
}

export interface ResponseResult {
  readonly success: boolean
  readonly message?: string
}

export interface ResponseActionOptions {
  readonly interaction: CommandInteraction
  readonly message: string
  readonly followUp?: string
  readonly error?: string
  readonly action: () => Promise<void>
}

export interface ResponderDependencies {
  readonly logger?: Logger
}

export function ResolveResponderLogger(dependencies?: ResponderDependencies): Logger {
  return dependencies?.logger ?? CreateConsoleLogger()
}

