import type { LoadedCommands } from "@bot/CreateCommandLoader";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import type { EventDefinition } from "@events";
import type { Logger } from "@shared/Logger";
import { createMockLogger } from "./mocks";

let commandLoadPromise: Promise<LoadedCommands> | undefined;
let eventLoadPromise: Promise<EventDefinition[]> | undefined;

export function LoadAllCommandsOnce(
  logger: Logger = createMockLogger(),
): Promise<LoadedCommands> {
  if (!commandLoadPromise) {
    commandLoadPromise = CreateCommandLoader(logger)();
  }
  return commandLoadPromise;
}

export function LoadAllEventsOnce(
  logger: Logger = createMockLogger(),
): Promise<EventDefinition[]> {
  if (!eventLoadPromise) {
    eventLoadPromise = CreateEventLoader(logger)();
  }
  return eventLoadPromise;
}
