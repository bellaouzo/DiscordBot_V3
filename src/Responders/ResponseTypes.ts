import {
  ActionRowData,
  ChatInputCommandInteraction,
  MessageCreateOptions,
  MessageEditOptions,
  ActionRowComponentData
} from 'discord.js'
import { CreateConsoleLogger, Logger } from '../Logging/Logger'

export type ResponderMessageOptions = Pick<MessageCreateOptions, 'content' | 'embeds' | 'files'> & {
  readonly ephemeral?: boolean
  readonly components?: ActionRowData<ActionRowComponentData>[]
}

export type ResponderEditOptions = Pick<MessageEditOptions, 'content' | 'embeds' | 'files' | 'components'>

export interface ResponseOptions extends ResponderMessageOptions {}

export interface ResponseResult {
  readonly success: boolean
  readonly message?: string
}

export interface ResponseActionOptions {
  readonly interaction: ChatInputCommandInteraction
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

