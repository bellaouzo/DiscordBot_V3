import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleLeaderboard } from "@systems/Economy/handlers/LeaderboardHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
} from "../../helpers";

describe("LeaderboardHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with empty leaderboard embed when no entries", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetTopBalances).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleLeaderboard(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toMatch(/Leaderboard/i);
  });

  it("replies with populated leaderboard embed", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue({
            displayName: "Alice",
            user: { username: "alice" },
          }),
        },
      } as unknown as import("discord.js").Guild,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetTopBalances).mockReturnValue([
      { userId: "u1", balance: 500, updatedAt: Date.now() },
      { userId: "u2", balance: 300, updatedAt: Date.now() },
    ]);
    const context = createMockContext({ databases });
    await HandleLeaderboard(interaction, context);
    expect(databases.userDb.GetTopBalances).toHaveBeenCalledWith("g1", 10);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.description).toContain("500");
  });
});
