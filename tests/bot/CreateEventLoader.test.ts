import { describe, expect, it } from "vitest";
import { LoadAllEventsOnce } from "../helpers/loaderCache";

describe("CreateEventLoader", () => {
  it("loads all events without errors", async () => {
    const events = await LoadAllEventsOnce();

    expect(events.length).toBeGreaterThanOrEqual(4);

    const names = events.map((event) => event.name);
    expect(new Set(names).size).toBe(names.length);

    for (const event of events) {
      expect(event.name).toBeTruthy();
      expect(typeof event.execute).toBe("function");
    }
  }, 30_000);
});
