import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { KickCommand } from "@commands/Moderation/KickCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("KickCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createKickInteraction(kickable: boolean) {
    const kick = vi.fn().mockResolvedValue(undefined);
    const targetMember = { kick, kickable, id: "target-id" };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        members: {
          cache: { get: vi.fn().mockReturnValue(undefined) },
          fetch: vi.fn().mockResolvedValue(targetMember),
        },
      } as unknown as Guild,
      user: { id: "mod-1", username: "Mod" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "target-id", username: "Target" }),
      getString: () => "rule break",
      getBoolean: () => false,
    });
    return { interaction, kick, targetMember };
  }

  it("rejects when target is not kickable", async () => {
    const { interaction } = createKickInteraction(false);
    const context = createMockContext();
    await expect(KickCommand.execute(interaction, context)).rejects.toThrow(
      "I cannot kick this user",
    );
  });

  it("records kick moderation event on success", async () => {
    const { interaction, kick } = createKickInteraction(true);
    const databases = createMockDatabaseSet();
    const context = createMockContext({ databases });
    await KickCommand.execute(interaction, context);
    expect(kick).toHaveBeenCalledWith("rule break");
    expect(databases.moderationDb.AddModerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kick",
        user_id: "target-id",
        moderator_id: "mod-1",
      }),
    );
  });
});
