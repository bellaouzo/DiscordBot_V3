import { describe, expect, it } from "vitest";
import { RequireGuild } from "@utilities/RequireGuild";
import { createMockInteraction } from "../helpers";

describe("RequireGuild", () => {
  it("returns guild when present", () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" },
    });

    expect(RequireGuild(interaction).id).toBe("guild-1");
  });

  it("throws when guild is missing", () => {
    const interaction = createMockInteraction({ guild: null });

    expect(() => RequireGuild(interaction)).toThrow("Expected guild context");
  });
});
