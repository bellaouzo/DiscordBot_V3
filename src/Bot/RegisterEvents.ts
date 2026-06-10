import type { Client, ClientEvents } from "discord.js";
import type { EventDefinition, EventContext } from "@events";
import type { Logger } from "@shared/Logger";
import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";

export interface RegisterEventsOptions {
  readonly client: Client;
  readonly events: EventDefinition<keyof ClientEvents>[];
  readonly logger: Logger;
  readonly responders: ResponderSet;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

export function RegisterEvents(options: RegisterEventsOptions): void {
  for (const event of options.events) {
    const handler = async (...args: ClientEvents[typeof event.name]) => {
      const eventLogger = options.logger.Child({
        extra: { event: event.name },
      });
      const context: EventContext = {
        client: options.client,
        logger: eventLogger,
        responders: options.responders,
        databases: options.databases,
        appConfig: options.appConfig,
      };

      try {
        await event.execute(context, ...args);
      } catch (error) {
        eventLogger.Error("Event handler failed", { error });
      }
    };

    if (event.once) {
      options.client.once(event.name, handler);
    } else {
      options.client.on(event.name, handler);
    }
  }
}
