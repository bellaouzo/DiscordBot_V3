import { describe, expect, it } from "vitest";
import {
  RequireDefined,
  RequireGuild,
  RequireGuildFromInteraction,
} from "@utilities/RequireGuild";
import { createMockInteraction } from "../helpers";

describe("RequireGuild utilities", () => {
  it("returns guild when present on slash commands", () => {
    const guild = { id: "guild-1" } as never;
    const interaction = createMockInteraction({ guild });
    expect(RequireGuild(interaction)).toBe(guild);
  });

  it("throws when guild is missing on slash commands", () => {
    const interaction = createMockInteraction({ guild: null });
    expect(() => RequireGuild(interaction)).toThrow("Expected guild context");
  });

  it("returns guild for generic interactions", () => {
    const guild = { id: "guild-1" } as never;
    expect(RequireGuildFromInteraction({ guild })).toBe(guild);
  });

  it("throws for undefined values via RequireDefined", () => {
    expect(() => RequireDefined(undefined, "Missing value")).toThrow(
      "Missing value",
    );
  });
});
