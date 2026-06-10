import Database from "better-sqlite3";
import { MapTempAction } from "@database/Moderation/Mappers";
import { TempAction, TempActionType } from "@database/Moderation/Types";

export class TempActionStore {
  constructor(private readonly db: Database.Database) {}

  AddTempAction(data: {
    action: TempActionType;
    guild_id: string;
    user_id: string;
    moderator_id: string;
    reason?: string | null;
    expires_at: number;
  }): TempAction {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO temp_actions (action, guild_id, user_id, moderator_id, reason, expires_at, processed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const id = stmt.run(
      data.action,
      data.guild_id,
      data.user_id,
      data.moderator_id,
      data.reason ?? null,
      data.expires_at,
      created_at,
      created_at,
    ).lastInsertRowid as number;

    const record = this.GetTempActionById(id);
    if (!record) {
      throw new Error("Failed to create temp action");
    }

    return record;
  }

  GetTempActionById(id: number): TempAction | null {
    const stmt = this.db.prepare("SELECT * FROM temp_actions WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapTempAction(row) : null;
  }

  GetPendingTempActions(options?: {
    guild_id?: string;
    before?: number;
  }): TempAction[] {
    const cutoff = options?.before ?? Number.MAX_SAFE_INTEGER;

    if (options?.guild_id) {
      const stmt = this.db.prepare(
        "SELECT * FROM temp_actions WHERE processed = 0 AND guild_id = ? AND expires_at <= ? ORDER BY expires_at ASC",
      );
      const rows = stmt.all(options.guild_id, cutoff) as Record<
        string,
        unknown
      >[];
      return rows.map((row) => MapTempAction(row));
    }

    const stmt = this.db.prepare(
      "SELECT * FROM temp_actions WHERE processed = 0 AND expires_at <= ? ORDER BY expires_at ASC",
    );
    const rows = stmt.all(cutoff) as Record<string, unknown>[];
    return rows.map((row) => MapTempAction(row));
  }

  ListPendingTempActions(guild_id: string): TempAction[] {
    const stmt = this.db.prepare(
      "SELECT * FROM temp_actions WHERE processed = 0 AND guild_id = ? ORDER BY expires_at ASC",
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTempAction(row));
  }

  MarkTempActionProcessed(id: number): boolean {
    const updated_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE temp_actions SET processed = 1, updated_at = ? WHERE id = ?",
    );
    const result = stmt.run(updated_at, id);
    return result.changes > 0;
  }

  RemoveTempActionById(id: number): boolean {
    const stmt = this.db.prepare("DELETE FROM temp_actions WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  GetActiveTempActionForUser(options: {
    guild_id: string;
    user_id: string;
    action: TempActionType;
  }): TempAction | null {
    const stmt = this.db.prepare(
      `
      SELECT *
      FROM temp_actions
      WHERE processed = 0
        AND guild_id = ?
        AND user_id = ?
        AND action = ?
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    );

    const row = stmt.get(options.guild_id, options.user_id, options.action) as
      | Record<string, unknown>
      | undefined;

    return row ? MapTempAction(row) : null;
  }

  ListUserTempActions(options: {
    guild_id: string;
    user_id: string;
    action: TempActionType;
    limit?: number;
  }): TempAction[] {
    const stmt = this.db.prepare(
      `
      SELECT *
      FROM temp_actions
      WHERE guild_id = ? AND user_id = ? AND action = ?
      ORDER BY created_at DESC
      ${options.limit ? "LIMIT ?" : ""}
    `,
    );

    const rows = options.limit
      ? (stmt.all(
          options.guild_id,
          options.user_id,
          options.action,
          options.limit,
        ) as Record<string, unknown>[])
      : (stmt.all(options.guild_id, options.user_id, options.action) as Record<
          string,
          unknown
        >[]);

    return rows.map((row) => MapTempAction(row));
  }
}
