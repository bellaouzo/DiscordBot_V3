import type Database from "better-sqlite3";

export class ChatXpDailyStore {
  constructor(private readonly db: Database.Database) {}

  GetEarned(user_id: string, guild_id: string, day_key: number): number {
    const stmt = this.db.prepare(
      "SELECT earned FROM chat_xp_daily WHERE user_id = ? AND guild_id = ? AND day_key = ?",
    );
    const row = stmt.get(user_id, guild_id, day_key) as
      | { earned: number }
      | undefined;

    return row?.earned ?? 0;
  }

  AddEarned(
    user_id: string,
    guild_id: string,
    day_key: number,
    amount: number,
  ): number {
    const existing = this.GetEarned(user_id, guild_id, day_key);
    const next = existing + amount;

    const stmt = this.db.prepare(`
      INSERT INTO chat_xp_daily (user_id, guild_id, day_key, earned)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id, day_key) DO UPDATE SET earned = excluded.earned
    `);
    stmt.run(user_id, guild_id, day_key, next);

    return next;
  }
}
