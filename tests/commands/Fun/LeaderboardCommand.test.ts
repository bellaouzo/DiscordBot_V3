import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { LeaderboardCommand } from "@commands/Fun/LeaderboardCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("LeaderboardCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends paginated coins leaderboard when entries exist", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        members: {
          fetch: vi.fn().mockImplementation((userId: string) =>
            Promise.resolve({
              displayName: userId === "u1" ? "Alice" : "Bob",
            }),
          ),
        },
      } as unknown as Guild,
      user: { id: "u1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getString: () => "coins",
    });

    const databases = createMockDatabaseSet();
    const entries = Array.from({ length: 15 }, (_, i) => ({
      userId: `u${i + 1}`,
      balance: 1000 - i * 50,
      updatedAt: Date.now(),
    }));
    vi.mocked(databases.userDb.GetTopBalances).mockReturnValue(entries);

    const context = createMockContext({ databases });
    await LeaderboardCommand.execute(interaction, context);

    expect(context.responders.paginatedResponder.Send).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        ownerId: "u1",
        pages: expect.arrayContaining([
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: "💰 Coins Leaderboard",
              }),
            ]),
          }),
        ]),
      }),
    );

    const sendArgs = (
      context.responders.paginatedResponder.Send as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(sendArgs.pages.length).toBe(2);
    expect(sendArgs.pages[0].embeds[0].description).toContain("🪙");
  });

  it("replies with empty leaderboard warning when no coin balances exist", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "u1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getString: () => "coins",
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetTopBalances).mockReturnValue([]);

    const context = createMockContext({ databases });
    await LeaderboardCommand.execute(interaction, context);

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
    expect(embed.title).toBe("No Economy Data");
  });
});
