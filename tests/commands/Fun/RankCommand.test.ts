import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { RankCommand } from "@commands/Fun/RankCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("RankCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTargetUser(): User {
    return {
      id: "target-user",
      displayName: "TargetUser",
      displayAvatarURL: () => "https://example.com/target.png",
    } as unknown as User;
  }

  it("replies with rank embed on success", async () => {
    const targetUser = createTargetUser();
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as unknown as Guild,
      user: targetUser,
    });
    stubInteractionOptions(interaction, {
      getUser: () => null,
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetUserXp).mockReturnValue({
      user_id: "target-user",
      guild_id: "guild-1",
      xp: 150,
      level: 4,
      total_xp_earned: 800,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.EnsureUserXp).mockReturnValue({
      user_id: "target-user",
      guild_id: "guild-1",
      xp: 150,
      level: 4,
      total_xp_earned: 800,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetXpForNextLevel).mockReturnValue(300);
    vi.mocked(databases.userDb.GetXpLeaderboard).mockReturnValue([
      { userId: "target-user", level: 4, xp: 150, totalXpEarned: 800 },
    ]);

    const context = createMockContext({ databases });
    await RankCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
      }),
    );

    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toContain("TargetUser's Level");
    expect(embed.description).toContain("Level 4");
    expect(embed.description).toContain("Server Rank");
  });

  it("replies with no XP record when user has no XP data", async () => {
    const targetUser = createTargetUser();
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as unknown as Guild,
      user: targetUser,
    });
    stubInteractionOptions(interaction, {
      getUser: () => targetUser,
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetUserXp).mockReturnValue(null);

    const context = createMockContext({ databases });
    await RankCommand.execute(interaction, context);

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
    expect(embed.title).toBe("No XP Record");
    expect(embed.description).toContain("TargetUser");
  });
});
