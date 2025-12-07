import Database from "better-sqlite3";
import * as fs from "fs";
import { join } from "path";
import { Logger } from "@shared/Logger";

export interface ScheduledEvent {
  id: number;
  guild_id: string;
  guild_event_id: number;
  title: string;
  scheduled_at: number;
  should_notify: boolean;
  created_by: string;
  created_at: number;
}

export class ServerDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = join(process.cwd(), "data");
    const dbPath = join(dataDir, "server.db");

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize server database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          guild_event_id INTEGER,
          title TEXT NOT NULL,
          scheduled_at INTEGER NOT NULL,
          should_notify INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_guild_time ON events(guild_id, scheduled_at);
      `);

      this.EnsureGuildEventIdColumn();
    } catch (error) {
      this.logger.Error("Failed to create server tables", { error });
      throw error;
    }
  }

  private EnsureGuildEventIdColumn(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(events)")
      .all() as Array<{ name: string }>;
    const hasColumn = columns.some(
      (column) => column.name === "guild_event_id"
    );

    if (hasColumn) {
      return;
    }

    const addColumn = this.db.prepare(
      "ALTER TABLE events ADD COLUMN guild_event_id INTEGER"
    );
    addColumn.run();

    this.BackfillGuildEventIds();
  }

  private BackfillGuildEventIds(): void {
    const guilds = this.db
      .prepare("SELECT DISTINCT guild_id FROM events")
      .all() as Array<{ guild_id: string }>;

    const selectEvents = this.db.prepare(
      "SELECT id FROM events WHERE guild_id = ? ORDER BY scheduled_at ASC, id ASC"
    );
    const updateEvent = this.db.prepare(
      "UPDATE events SET guild_event_id = ? WHERE id = ?"
    );

    const transaction = this.db.transaction(() => {
      guilds.forEach((guild) => {
        const events = selectEvents.all(guild.guild_id) as Array<{
          id: number;
        }>;
        events.forEach((event, index) => {
          updateEvent.run(index + 1, event.id);
        });
      });
    });

    transaction();
  }

  private NextGuildEventId(guild_id: string): number {
    const rows = this.db
      .prepare(
        "SELECT guild_event_id FROM events WHERE guild_id = ? AND guild_event_id IS NOT NULL ORDER BY guild_event_id ASC"
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
      created_at
    ).lastInsertRowid as number;

    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id) as
      | {
          id: number;
          guild_id: string;
          guild_event_id: number | null;
          title: string;
          scheduled_at: number;
          should_notify: number;
          created_by: string;
          created_at: number;
        }
      | undefined;

    if (!row) {
      throw new Error("Failed to create event");
    }

    return {
      id: row.id,
      guild_id: row.guild_id,
      guild_event_id: row.guild_event_id ?? guild_event_id,
      title: row.title,
      scheduled_at: row.scheduled_at,
      should_notify: Boolean(row.should_notify),
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  ListUpcomingEvents(guild_id: string, after?: number): ScheduledEvent[] {
    const baseline = after ?? Date.now();
    const stmt = this.db.prepare(
      "SELECT * FROM events WHERE guild_id = ? AND scheduled_at >= ? ORDER BY scheduled_at ASC"
    );
    const rows = stmt.all(guild_id, baseline) as Array<{
      id: number;
      guild_id: string;
      guild_event_id: number | null;
      title: string;
      scheduled_at: number;
      should_notify: number;
      created_by: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      guild_id: row.guild_id,
      guild_event_id: row.guild_event_id ?? row.id,
      title: row.title,
      scheduled_at: row.scheduled_at,
      should_notify: Boolean(row.should_notify),
      created_by: row.created_by,
      created_at: row.created_at,
    }));
  }

  GetEventById(
    guild_event_id: number,
    guild_id: string
  ): ScheduledEvent | null {
    const stmt = this.db.prepare(
      "SELECT * FROM events WHERE guild_event_id = ? AND guild_id = ?"
    );
    const row = stmt.get(guild_event_id, guild_id) as
      | {
          id: number;
          guild_id: string;
          guild_event_id: number | null;
          title: string;
          scheduled_at: number;
          should_notify: number;
          created_by: string;
          created_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      guild_id: row.guild_id,
      guild_event_id: row.guild_event_id ?? row.id,
      title: row.title,
      scheduled_at: row.scheduled_at,
      should_notify: Boolean(row.should_notify),
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  DeleteEvent(guild_event_id: number, guild_id: string): boolean {
    const stmtByGuildEvent = this.db.prepare(
      "DELETE FROM events WHERE guild_event_id = ? AND guild_id = ?"
    );
    const byGuildEvent = stmtByGuildEvent.run(guild_event_id, guild_id);

    if (byGuildEvent.changes > 0) {
      return true;
    }

    // Fallback: attempt deletion by primary key for legacy rows
    const stmtById = this.db.prepare(
      "DELETE FROM events WHERE id = ? AND guild_id = ?"
    );
    const byId = stmtById.run(guild_event_id, guild_id);

    return byId.changes > 0;
  }

  Close(): void {
    this.db.close();
  }
}
