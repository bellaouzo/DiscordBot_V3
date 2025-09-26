import { Client } from 'discord.js'
import { Logger } from '../Shared/Logger'
import { ResponderSet } from '../Responders'

export interface EventContext {
  readonly client: Client
  readonly logger: Logger
  readonly responders: ResponderSet
}

export type EventExecutor = (context: EventContext, ...args: unknown[]) => Promise<void> | void

export interface EventDefinition {
  readonly name: string
  readonly once?: boolean
  readonly execute: EventExecutor
}

export interface EventFactoryOptions {
  readonly name: string
  readonly once?: boolean
  readonly execute: EventExecutor
}

export function CreateEvent(options: EventFactoryOptions): EventDefinition {
  return {
    name: options.name,
    once: options.once,
    execute: options.execute
  }
}
