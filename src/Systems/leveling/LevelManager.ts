import { UserDatabase } from "@database";
import { CalculateXpForLevel } from "./constants";
import type { UserLevel, LeaderboardEntry, XpAwardResult } from "./types";

export class LevelManager {
  constructor(
    private readonly guildId: string,
    private readonly userDb: UserDatabase
  ) {}

  /**
   * Get user's current level information
   */
  GetUserLevel(userId: string): UserLevel {
    const userXp = this.userDb.EnsureUserXp(userId, this.guildId);
    const xpToNextLevel = this.userDb.GetXpForNextLevel(userXp.level);
    const progressPercent = Math.floor((userXp.xp / xpToNextLevel) * 100);

    return {
      userId,
      guildId: this.guildId,
      level: userXp.level,
      currentXp: userXp.xp,
      xpToNextLevel,
      totalXpEarned: userXp.total_xp_earned,
      progressPercent,
    };
  }

  /**
   * Award XP to a user
   * @returns XP award result including level up info
   */
  AddXp(userId: string, amount: number): XpAwardResult {
    const result = this.userDb.AddXp({
      user_id: userId,
      guild_id: this.guildId,
      amount,
    });

    return {
      xpGained: amount,
      leveledUp: result.leveledUp,
      newLevel: result.leveledUp ? result.userXp.level : undefined,
      previousLevel: result.leveledUp ? result.previousLevel : undefined,
    };
  }

  /**
   * Get XP leaderboard for the guild
   */
  GetLeaderboard(limit = 10): LeaderboardEntry[] {
    const entries = this.userDb.GetXpLeaderboard(this.guildId, limit);

    return entries.map((entry, index) => ({
      userId: entry.userId,
      level: entry.level,
      xp: entry.xp,
      totalXpEarned: entry.totalXpEarned,
      rank: index + 1,
    }));
  }

  /**
   * Get XP required to reach the next level from current level
   */
  GetXpForNextLevel(currentLevel: number): number {
    return CalculateXpForLevel(currentLevel);
  }

  /**
   * Calculate the user's rank in the server
   */
  GetUserRank(userId: string): number {
    // Get a large leaderboard and find user position
    const entries = this.userDb.GetXpLeaderboard(this.guildId, 1000);
    const index = entries.findIndex((e) => e.userId === userId);
    return index === -1 ? entries.length + 1 : index + 1;
  }
}
