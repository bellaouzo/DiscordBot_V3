import { describe, it, expect, vi, beforeEach } from "vitest";
import { LevelManager } from "@systems/Leveling/LevelManager";
import { createMockDatabaseSet } from "../../helpers";

describe("LevelManager", () => {
  const guildId = "guild-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GetUserLevel returns level info from userDb", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureUserXp).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      xp: 50,
      level: 2,
      total_xp_earned: 150,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetXpForNextLevel).mockReturnValue(283);
    const manager = new LevelManager(guildId, databases.userDb);
    const result = manager.GetUserLevel("u1");
    expect(result.userId).toBe("u1");
    expect(result.guildId).toBe(guildId);
    expect(result.level).toBe(2);
    expect(result.currentXp).toBe(50);
    expect(result.xpToNextLevel).toBe(283);
    expect(result.totalXpEarned).toBe(150);
  });

  it("AddXp returns result from userDb", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.AddXp).mockReturnValue({
      leveledUp: true,
      userXp: {
        user_id: "u1",
        guild_id: guildId,
        xp: 0,
        level: 3,
        total_xp_earned: 400,
        updated_at: Date.now(),
      },
      previousLevel: 2,
    });
    const manager = new LevelManager(guildId, databases.userDb);
    const result = manager.AddXp("u1", 100);
    expect(result.xpGained).toBe(100);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(3);
    expect(result.previousLevel).toBe(2);
    expect(databases.userDb.AddXp).toHaveBeenCalledWith({
      user_id: "u1",
      guild_id: guildId,
      amount: 100,
    });
  });

  it("GetLeaderboard maps userDb entries with rank", () => {
    const databases = createMockDatabaseSet();
    const entries = [
      { userId: "u1", xp: 500, level: 5, totalXpEarned: 500 },
      { userId: "u2", xp: 300, level: 4, totalXpEarned: 300 },
    ];
    vi.mocked(databases.userDb.GetXpLeaderboard).mockReturnValue(entries);
    const manager = new LevelManager(guildId, databases.userDb);
    const result = manager.GetLeaderboard(10);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("u1");
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it("GetXpForNextLevel delegates to CalculateXpForLevel", () => {
    const databases = createMockDatabaseSet();
    const manager = new LevelManager(guildId, databases.userDb);
    expect(manager.GetXpForNextLevel(1)).toBe(100);
    expect(manager.GetXpForNextLevel(2)).toBeGreaterThan(100);
  });

  it("GetUserRank returns position in leaderboard", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetXpLeaderboard).mockReturnValue([
      { userId: "u1", xp: 100, level: 1, totalXpEarned: 100 },
      { userId: "u2", xp: 50, level: 1, totalXpEarned: 50 },
      { userId: "u3", xp: 25, level: 1, totalXpEarned: 25 },
    ]);
    const manager = new LevelManager(guildId, databases.userDb);
    expect(manager.GetUserRank("u2")).toBe(2);
    expect(manager.GetUserRank("u99")).toBe(4);
  });
});
