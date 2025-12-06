import { Client } from "discord.js";
import { EventDefinition, EventContext } from "../Events";
import { Logger } from "../Shared/Logger";
import { ResponderSet } from "../Responders";

export interface RegisterEventsOptions {
  readonly client: Client;
  readonly events: EventDefinition[];
  readonly logger: Logger;
  readonly responders: ResponderSet;
}

export function RegisterEvents(options: RegisterEventsOptions): void {
  for (const event of options.events) {
    const handler = async (...args: unknown[]) => {
      const eventLogger = options.logger.Child({
        extra: { event: event.name },
      });
      const context: EventContext = {
        client: options.client,
        logger: eventLogger,
        responders: options.responders,
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
