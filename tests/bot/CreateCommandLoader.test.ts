import { describe, expect, it } from "vitest";
import { CreateCommandLoader } from "@bot/CreateCommandLoader";
import { createMockLogger } from "../helpers";

describe("CreateCommandLoader", () => {
  it("loads all commands without errors or duplicate names", async () => {
    const loadCommands = CreateCommandLoader(createMockLogger());
    const result = await loadCommands();

    expect(result.errors).toHaveLength(0);
    expect(result.definitions.length).toBeGreaterThanOrEqual(45);

    const names = result.definitions.map((command) => command.data.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    for (const expected of ["ping", "kick", "help", "setup", "ticket"]) {
      expect(names).toContain(expected);
    }
  }, 60_000);
});
