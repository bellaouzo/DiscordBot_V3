import Database from "better-sqlite3";
import { MapWarning } from "@database/User/Mappers";
import { Warning } from "@database/User/Types";

export class WarningStore {
  constructor(private readonly db: Database.Database) {}

  AddWarning(data: {
    user_id: string;
    guild_id: string;
    moderator_id: string;
    reason?: string | null;
  }): Warning {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO warnings (user_id, guild_id, moderator_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.user_id,
      data.guild_id,
      data.moderator_id,
      data.reason ?? null,
      created_at,
    ).lastInsertRowid as number;

    const warning = this.GetWarningById(id, data.guild_id);
    if (!warning) {
      throw new Error("Failed to create warning");
    }

    return warning;
  }

  GetWarnings(user_id: string, guild_id: string, limit?: number): Warning[] {
    const stmt = this.db.prepare(`
      SELECT * FROM warnings
      WHERE user_id = ? AND guild_id = ?
      ORDER BY created_at ASC
      ${limit ? "LIMIT ?" : ""}
    `);

    const rows = limit
      ? (stmt.all(user_id, guild_id, limit) as Record<string, unknown>[])
      : (stmt.all(user_id, guild_id) as Record<string, unknown>[]);

    return rows.map((row) => MapWarning(row));
  }

  GetWarningById(id: number, guild_id: string): Warning | null {
    const stmt = this.db.prepare(
      "SELECT * FROM warnings WHERE id = ? AND guild_id = ?",
    );
    const row = stmt.get(id, guild_id) as Record<string, unknown> | undefined;
    return row ? MapWarning(row) : null;
  }

  RemoveWarningById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM warnings WHERE id = ? AND guild_id = ?",
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestWarning(user_id: string, guild_id: string): Warning | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM warnings
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      )
      .get(user_id, guild_id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const warning = MapWarning(row);
    const removed = this.RemoveWarningById(warning.id, guild_id);
    return removed ? warning : null;
  }
}
