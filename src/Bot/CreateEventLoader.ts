import { readdirSync } from "fs";
import { join } from "path";
import type { EventDefinition } from "@events";
import type { Logger } from "@shared/Logger";
import type { LoadError } from "./CreateCommandLoader";

export type EventLoader = () => Promise<EventDefinition[]>;

function isEventFile(file: string): boolean {
  if (typeof file !== "string") return false;
  if (!/Event\.(js|ts)$/.test(file)) return false;
  if (file.endsWith(".d.ts")) return false;
  if (file.includes("EventFactory.")) return false;
  if (file.includes("index.")) return false;
  return true;
}

function ThrowIfLoadFailed(errors: LoadError[]): void {
  if (errors.length === 0) {
    return;
  }

  const summary = errors
    .map((entry) => `- ${entry.file}: ${String(entry.error)}`)
    .join("\n");

  throw new Error(`Failed to load ${errors.length} event file(s):\n${summary}`);
}

export function CreateEventLoader(logger: Logger): EventLoader {
  return async () => {
    const events: EventDefinition[] = [];
    const errors: LoadError[] = [];
    const eventsPath = join(__dirname, "..", "Events");

    const eventFiles = readdirSync(eventsPath, { recursive: true }).filter(
      (file) => isEventFile(file as string),
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
        errors.push({ file: String(file), error });
      }
    }

    ThrowIfLoadFailed(errors);

    if (events.length === 0) {
      throw new Error("No events were loaded from the Events directory");
    }

    logger.Debug("Loaded all events", { timestamp: new Date().toISOString() });

    return events;
  };
}
