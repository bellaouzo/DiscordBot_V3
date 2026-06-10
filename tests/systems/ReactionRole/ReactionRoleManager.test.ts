import { describe, expect, it, vi } from "vitest";
import { ReactionRoleManager } from "@systems/ReactionRole/ReactionRoleManager";
import { createMockLogger } from "../../helpers";

describe("ReactionRoleManager", () => {
  it("skips bot users", async () => {
    const serverDb = {
      GetReactionRoleMappingByEmoji: vi.fn(),
    };
    const manager = new ReactionRoleManager(
      serverDb as never,
      createMockLogger(),
    );

    await manager.HandleReactionAdd(
      {
        partial: false,
        emoji: { name: "🎮", id: null },
        message: { guild: { id: "guild-1" }, id: "msg-1" },
      } as never,
      { bot: true } as never,
    );

    expect(serverDb.GetReactionRoleMappingByEmoji).not.toHaveBeenCalled();
  });
});
