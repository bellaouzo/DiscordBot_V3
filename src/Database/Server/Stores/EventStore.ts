import type Database from "better-sqlite3";
import { MapScheduledEvent } from "@database/Server/Mappers";
import type { EventRow, ScheduledEvent } from "@database/Server/Types";

export class EventStore {
  constructor(private readonly db: Database.Database) {}

  CreateEvent(data: {
    guild_id: string;
    title: string;
    scheduled_at: number;
    should_notify: boolean;
    created_by: string;
  }): ScheduledEvent {
    const created_at = Date.now();
    const guild_event_id = this.NextGuildEventId(data.guild_id);
    const stmt = this.db.prepare(`
      INSERT INTO events (guild_id, guild_event_id, title, scheduled_at, should_notify, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.guild_id,
      guild_event_id,
      data.title,
      data.scheduled_at,
      data.should_notify ? 1 : 0,
      data.created_by,
      created_at,
    ).lastInsertRowid as number;

    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id) as
      | EventRow
      | undefined;

    if (!row) {
      throw new Error("Failed to create event");
    }

    return MapScheduledEvent(row, guild_event_id);
  }

  ListUpcomingEvents(guild_id: string, after?: number): ScheduledEvent[] {
    const baseline = after ?? Date.now();
    const stmt = this.db.prepare(
      "SELECT * FROM events WHERE guild_id = ? AND scheduled_at >= ? ORDER BY scheduled_at ASC",
    );
    const rows = stmt.all(guild_id, baseline) as EventRow[];

    return rows.map((row) => MapScheduledEvent(row));
  }

  GetEventById(
    guild_event_id: number,
    guild_id: string,
  ): ScheduledEvent | null {
    const stmt = this.db.prepare(
      "SELECT * FROM events WHERE guild_event_id = ? AND guild_id = ?",
    );
    const row = stmt.get(guild_event_id, guild_id) as EventRow | undefined;

    if (!row) {
      return null;
    }

    return MapScheduledEvent(row);
  }

  ListEventsDueForNotification(now: number): ScheduledEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM events
      WHERE should_notify = 1
        AND scheduled_at <= ?
        AND notified_at IS NULL
      ORDER BY scheduled_at ASC
    `);
    const rows = stmt.all(now) as EventRow[];

    return rows.map((row) => MapScheduledEvent(row));
  }

  MarkEventNotified(id: number, notifiedAt: number): boolean {
    const stmt = this.db.prepare(
      "UPDATE events SET notified_at = ? WHERE id = ? AND notified_at IS NULL",
    );
    const result = stmt.run(notifiedAt, id);

    return result.changes > 0;
  }

  DeleteEvent(guild_event_id: number, guild_id: string): boolean {
    const stmtByGuildEvent = this.db.prepare(
      "DELETE FROM events WHERE guild_event_id = ? AND guild_id = ?",
    );
    const byGuildEvent = stmtByGuildEvent.run(guild_event_id, guild_id);

    if (byGuildEvent.changes > 0) {
      return true;
    }

    const stmtById = this.db.prepare(
      "DELETE FROM events WHERE id = ? AND guild_id = ?",
    );
    const byId = stmtById.run(guild_event_id, guild_id);

    return byId.changes > 0;
  }

  private NextGuildEventId(guild_id: string): number {
    const rows = this.db
      .prepare(
        "SELECT guild_event_id FROM events WHERE guild_id = ? AND guild_event_id IS NOT NULL ORDER BY guild_event_id ASC",
      )
      .all(guild_id) as Array<{ guild_event_id: number }>;

    if (rows.length === 0) {
      return 1;
    }

    let expected = 1;
    for (const row of rows) {
      if (row.guild_event_id > expected) {
        return expected;
      }
      expected = row.guild_event_id + 1;
    }

    return expected;
  }
}
