import { describe, expect, it } from "vitest";
import { CreateEventLoader } from "@bot/CreateEventLoader";
import { createMockLogger } from "../helpers";

describe("CreateEventLoader", () => {
  it("loads all events without errors", async () => {
    const loadEvents = CreateEventLoader(createMockLogger());
    const events = await loadEvents();

    expect(events.length).toBeGreaterThanOrEqual(4);

    const names = events.map((event) => event.name);
    expect(new Set(names).size).toBe(names.length);

    for (const event of events) {
      expect(event.name).toBeTruthy();
      expect(typeof event.execute).toBe("function");
    }
  }, 60_000);
});
