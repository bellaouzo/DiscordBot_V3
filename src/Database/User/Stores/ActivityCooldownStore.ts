import type Database from "better-sqlite3";

export class ActivityCooldownStore {
  constructor(private readonly db: Database.Database) {}

  /**
   * Starts an earning activity (e.g. "work") if its cooldown has elapsed, recording now as
   * the last use. Check and record happen in one transaction so parallel starts can't both win.
   */
  ClaimActivity(options: {
    user_id: string;
    guild_id: string;
    activity: string;
    cooldownMs: number;
  }): { success: true } | { success: false; nextAvailableAt: number } {
    const transaction = this.db.transaction(() => {
      const now = Date.now();
      const row = this.db
        .prepare(
          "SELECT last_used_at FROM economy_activity_cooldowns WHERE user_id = ? AND guild_id = ? AND activity = ?",
        )
        .get(options.user_id, options.guild_id, options.activity) as
        | { last_used_at: number }
        | undefined;

      if (row && now < row.last_used_at + options.cooldownMs) {
        return {
          success: false as const,
          nextAvailableAt: row.last_used_at + options.cooldownMs,
        };
      }

      this.db
        .prepare(
          `
          INSERT INTO economy_activity_cooldowns (user_id, guild_id, activity, last_used_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, guild_id, activity) DO UPDATE SET last_used_at = excluded.last_used_at
        `,
        )
        .run(options.user_id, options.guild_id, options.activity, now);

      return { success: true as const };
    });

    return transaction();
  }

  /** Gives back a claimed activity, e.g. when its prompt could not be sent or timed out. */
  ReleaseActivity(user_id: string, guild_id: string, activity: string): void {
    this.db
      .prepare(
        "DELETE FROM economy_activity_cooldowns WHERE user_id = ? AND guild_id = ? AND activity = ?",
      )
      .run(user_id, guild_id, activity);
  }
}
