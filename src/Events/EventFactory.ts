import type { Client, ClientEvents } from "discord.js";
import type { Logger } from "@shared/Logger";
import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";

export interface EventContext {
  readonly client: Client;
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

export type TypedEventExecutor<K extends keyof ClientEvents> = (
  context: EventContext,
  ...args: ClientEvents[K]
) => Promise<void> | void;

export type EventExecutor = (
  context: EventContext,
  ...args: unknown[]
) => Promise<void> | void;

export interface EventDefinition<
  K extends keyof ClientEvents = keyof ClientEvents,
> {
  readonly name: K;
  readonly once?: boolean;
  readonly execute: TypedEventExecutor<K>;
}

export interface EventFactoryOptions<K extends keyof ClientEvents> {
  readonly name: K;
  readonly once?: boolean;
  readonly execute: TypedEventExecutor<K>;
}

export function CreateEvent<K extends keyof ClientEvents>(
  options: EventFactoryOptions<K>,
): EventDefinition<K> {
  return {
    name: options.name,
    once: options.once,
    execute: options.execute,
  };
}
