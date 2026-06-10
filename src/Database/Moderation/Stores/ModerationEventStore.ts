import Database from "better-sqlite3";
import { MapModerationEvent } from "@database/Moderation/Mappers";
import { ModerationEvent } from "@database/Moderation/Types";

export class ModerationEventStore {
  constructor(private readonly db: Database.Database) {}

  AddModerationEvent(data: {
    guild_id: string;
    user_id: string;
    moderator_id: string;
    action: "kick" | "ban";
    reason?: string | null;
    duration_ms?: number | null;
  }): void {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO moderation_events (guild_id, user_id, moderator_id, action, reason, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.guild_id,
      data.user_id,
      data.moderator_id,
      data.action,
      data.reason ?? null,
      data.duration_ms ?? null,
      created_at,
    );
  }

  ListModerationEvents(options: {
    guild_id: string;
    user_id: string;
    action: "kick" | "ban";
    limit?: number;
  }): ModerationEvent[] {
    const stmt = this.db.prepare(
      `
      SELECT id, guild_id, user_id, moderator_id, action, reason, duration_ms, created_at
      FROM moderation_events
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

    return rows.map((row) => MapModerationEvent(row));
  }

  CountModerationEvents(options: {
    guild_id: string;
    user_id: string;
    action: "kick" | "ban";
  }): number {
    const stmt = this.db.prepare(
      `
      SELECT COUNT(*) as count
      FROM moderation_events
      WHERE guild_id = ? AND user_id = ? AND action = ?
    `,
    );

    const row = stmt.get(options.guild_id, options.user_id, options.action) as
      | { count: number }
      | undefined;

    return row?.count ?? 0;
  }

  RemoveModerationEventById(data: {
    id: number;
    guild_id: string;
    action?: "kick" | "ban";
  }): boolean {
    const stmt = data.action
      ? this.db.prepare(
          "DELETE FROM moderation_events WHERE id = ? AND guild_id = ? AND action = ?",
        )
      : this.db.prepare(
          "DELETE FROM moderation_events WHERE id = ? AND guild_id = ?",
        );

    const result = data.action
      ? stmt.run(data.id, data.guild_id, data.action)
      : stmt.run(data.id, data.guild_id);

    return result.changes > 0;
  }
}
