import { EventDefinition } from './EventFactory'

const eventRegistry = new Map<string, EventDefinition>

export function RegisterEvent(event: EventDefinition): void {
  eventRegistry.set(event.name, event)
}

export function GetRegisteredEvents(): Iterable<EventDefinition> {
  return eventRegistry.values()
}