import {
  ActionRowData,
  ChatInputCommandInteraction,
  MessageCreateOptions,
  MessageEditOptions,
  ActionRowComponentData,
  MessageFlags
} from 'discord.js'
import { CreateConsoleLogger, Logger } from '../Shared/Logger'

export type ResponderMessageOptions = Pick<MessageCreateOptions, 'content' | 'embeds' | 'files'> & {
  readonly ephemeral?: boolean
  readonly flags?: MessageFlags[]
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

export function ConvertToInteractionFlags(options: ResponderMessageOptions): MessageFlags.Ephemeral | undefined {
  // If explicit flags are provided, check for Ephemeral flag
  if (options.flags !== undefined && options.flags.length > 0) {
    const hasEphemeral = options.flags.some(flag => flag === MessageFlags.Ephemeral)
    return hasEphemeral ? MessageFlags.Ephemeral : undefined
  }
  
  // Convert legacy ephemeral property to flags
  if (options.ephemeral === true) {
    return MessageFlags.Ephemeral
  }
  
  // Default to undefined (no flags)
  return undefined
}

