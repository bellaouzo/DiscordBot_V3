import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, User } from "discord.js";
import { ProfileCommand } from "@commands/Fun/ProfileCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("ProfileCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTargetUser(overrides: Partial<User> = {}): User {
    return {
      id: "target-user",
      username: "TargetUser",
      displayName: "TargetUser",
      displayAvatarURL: () => "https://example.com/target.png",
      createdTimestamp: Date.now() - 86_400_000,
      flags: { toArray: () => [] },
      ...overrides,
    } as unknown as User;
  }

  it("replies with profile embed containing user stats on success", async () => {
    const targetUser = createTargetUser();
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        members: {
          fetch: vi.fn().mockResolvedValue({
            displayName: "TargetUser",
            joinedTimestamp: Date.now() - 3_600_000,
            roles: { cache: { size: 3 } },
            presence: { status: "online", activities: [{ name: "Testing" }] },
          }),
        },
      } as unknown as Guild,
      user: {
        id: "requester",
        displayName: "Requester",
        displayAvatarURL: () => "https://example.com/requester.png",
      } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => targetUser,
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureUserXp).mockReturnValue({
      user_id: "target-user",
      guild_id: "guild-1",
      xp: 250,
      level: 5,
      total_xp_earned: 1200,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetXpForNextLevel).mockReturnValue(500);
    vi.mocked(databases.userDb.GetXpLeaderboard).mockReturnValue([
      { userId: "target-user", level: 5, xp: 250, totalXpEarned: 1200 },
    ]);
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "target-user",
      guild_id: "guild-1",
      balance: 750,
      updated_at: Date.now(),
    });

    const context = createMockContext({ databases });
    await ProfileCommand.execute(interaction, context);

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
    expect(embed.title).toContain("TargetUser's Profile");
    expect(embed.fields.some((f: { name: string }) => f.name === "📊 Level & XP")).toBe(
      true,
    );
    expect(embed.fields.some((f: { name: string }) => f.name === "💰 Economy")).toBe(
      true,
    );
  });

  it("replies with user not found when requested member is absent", async () => {
    const targetUser = createTargetUser();
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        members: {
          fetch: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Guild,
      user: {
        id: "requester",
        displayName: "Requester",
        displayAvatarURL: () => "https://example.com/requester.png",
      } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => targetUser,
    });

    const context = createMockContext();
    await ProfileCommand.execute(interaction, context);

    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("User Not Found");
    expect(embed.description).toContain("TargetUser");
  });
});
