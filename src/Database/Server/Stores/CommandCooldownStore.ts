import type Database from "better-sqlite3";

export class CommandCooldownStore {
  constructor(private readonly db: Database.Database) {}

  GetExpiry(userId: string, commandName: string): number | undefined {
    const row = this.db
      .prepare(
        "SELECT expires_at FROM command_cooldowns WHERE user_id = ? AND command_name = ?",
      )
      .get(userId, commandName) as { expires_at: number } | undefined;

    return row?.expires_at;
  }

  SetExpiry(userId: string, commandName: string, expiresAt: number): void {
    this.db
      .prepare(
        `
        INSERT INTO command_cooldowns (user_id, command_name, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, command_name) DO UPDATE SET expires_at = excluded.expires_at
      `,
      )
      .run(userId, commandName, expiresAt);
  }

  PruneExpired(now: number): void {
    this.db
      .prepare("DELETE FROM command_cooldowns WHERE expires_at <= ?")
      .run(now);
  }
}
