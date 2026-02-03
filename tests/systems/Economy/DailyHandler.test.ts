import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleDaily } from "@systems/Economy/handlers/DailyHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
} from "../../helpers";

describe("DailyHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with daily embed on successful claim", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    const nextAt = Date.now() + 86400000;
    vi.mocked(databases.userDb.ClaimDaily).mockReturnValue({
      success: true,
      balance: {
        user_id: "u1",
        guild_id: "g1",
        balance: 200,
        updated_at: Date.now(),
      },
      nextAvailableAt: nextAt,
    });
    const context = createMockContext({ databases });
    await HandleDaily(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
    expect(databases.userDb.ClaimDaily).toHaveBeenCalled();
  });

  it("replies with daily embed on cooldown", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    const nextAt = Date.now() + 3600000;
    vi.mocked(databases.userDb.ClaimDaily).mockReturnValue({
      success: false,
      nextAvailableAt: nextAt,
    });
    const context = createMockContext({ databases });
    await HandleDaily(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
  });
});
