import { readdirSync } from "fs";
import { join } from "path";
import { EventDefinition } from "../Events";
import { Logger } from "../Shared/Logger";

export type EventLoader = () => Promise<EventDefinition[]>;

export function CreateEventLoader(logger: Logger): EventLoader {
  return async () => {
    const events: EventDefinition[] = [];

    const eventsPath = join(__dirname, "..", "Events");
    const eventFiles = readdirSync(eventsPath, { recursive: true }).filter(
      (file) =>
        typeof file === "string" &&
        file.endsWith(".js") &&
        !file.includes("index.js") &&
        !file.includes("registry.js") &&
        !file.includes("EventFactory.js"),
    );

    for (const file of eventFiles) {
      try {
        const modulePath = join(eventsPath, file as string);
        const module = await import(modulePath);

        const eventExports = Object.values(module).filter(
          (exp) =>
            exp && typeof exp === "object" && "name" in exp && "execute" in exp,
        ) as EventDefinition[];

        for (const event of eventExports) {
          events.push(event);
        }
      } catch (error) {
        logger.Error("Failed to load event file", {
          file: String(file),
          error,
        });
      }
    }

    logger.Debug("Loaded all events", { timestamp: new Date().toISOString() });

    return events;
  };
}
