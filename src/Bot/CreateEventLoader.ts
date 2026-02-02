import { readdirSync } from "fs";
import { join } from "path";
import { EventDefinition } from "@events";
import { Logger } from "@shared/Logger";

export type EventLoader = () => Promise<EventDefinition[]>;

export function CreateEventLoader(logger: Logger): EventLoader {
  return async () => {
    const events: EventDefinition[] = [];
    const eventsPath = join(__dirname, "..", "Events");

    const isEventFile = (file: string): boolean => {
      if (typeof file !== "string") return false;
      if (!/Event\.(js|ts)$/.test(file)) return false;
      if (file.endsWith(".d.ts")) return false;
      if (file.includes("EventFactory.")) return false;
      if (file.includes("index.")) return false;
      return true;
    };

    const eventFiles = readdirSync(eventsPath, { recursive: true }).filter(
      (file) => isEventFile(file as string)
    );

    for (const file of eventFiles) {
      try {
        const modulePath = join(eventsPath, file as string);
        const module = await import(modulePath);

        const eventExports = Object.values(module).filter(
          (exp) =>
            exp && typeof exp === "object" && "name" in exp && "execute" in exp
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
