import type Database from "better-sqlite3";
import { CalculateXpForLevel, MapUserXp } from "@database/User/Mappers";
import type { UserXp } from "@database/User/Types";

export class XpStore {
  constructor(private readonly db: Database.Database) {}

  GetUserXp(user_id: string, guild_id: string): UserXp | null {
    const stmt = this.db.prepare(
      "SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?",
    );
    const row = stmt.get(user_id, guild_id) as
      | Record<string, unknown>
      | undefined;
    return row ? MapUserXp(row) : null;
  }

  EnsureUserXp(user_id: string, guild_id: string): UserXp {
    const existing = this.GetUserXp(user_id, guild_id);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    this.db
      .prepare(
        `
        INSERT INTO user_xp (user_id, guild_id, xp, level, total_xp_earned, updated_at)
        VALUES (?, ?, 0, 1, 0, ?)
      `,
      )
      .run(user_id, guild_id, now);

    const created = this.GetUserXp(user_id, guild_id);
    if (!created) {
      throw new Error("Failed to initialize user XP");
    }
    return created;
  }

  AddXp(data: { user_id: string; guild_id: string; amount: number }): {
    userXp: UserXp;
    leveledUp: boolean;
    previousLevel: number;
  } {
    const transaction = this.db.transaction(() => {
      const current = this.EnsureUserXp(data.user_id, data.guild_id);
      const previousLevel = current.level;
      let xp = current.xp + data.amount;
      let level = current.level;
      let leveledUp = false;

      let xpNeeded = CalculateXpForLevel(level);
      while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        leveledUp = true;
        xpNeeded = CalculateXpForLevel(level);
      }

      const now = Date.now();
      this.db
        .prepare(
          `
          UPDATE user_xp
          SET xp = ?, level = ?, total_xp_earned = total_xp_earned + ?, updated_at = ?
          WHERE user_id = ? AND guild_id = ?
        `,
        )
        .run(xp, level, data.amount, now, data.user_id, data.guild_id);

      const updated = this.GetUserXp(data.user_id, data.guild_id);
      if (!updated) {
        throw new Error("Failed to load updated user XP");
      }
      return { userXp: updated, leveledUp, previousLevel };
    });

    return transaction();
  }

  GetXpLeaderboard(
    guild_id: string,
    limit = 10,
  ): { userId: string; xp: number; level: number; totalXpEarned: number }[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, xp, level, total_xp_earned
      FROM user_xp
      WHERE guild_id = ?
      ORDER BY level DESC, xp DESC
      LIMIT ?
    `,
    );

    const rows = stmt.all(guild_id, limit) as {
      user_id: string;
      xp: number;
      level: number;
      total_xp_earned: number;
    }[];

    return rows.map((row) => ({
      userId: row.user_id,
      xp: row.xp,
      level: row.level,
      totalXpEarned: row.total_xp_earned,
    }));
  }

  GetXpForNextLevel(level: number): number {
    return CalculateXpForLevel(level);
  }
}
