import Database from "better-sqlite3";
import * as fs from "fs";
import { join } from "path";
import { Logger } from "@shared/Logger";

export interface ScheduledEvent {
  id: number;
  guild_id: string;
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
          title TEXT NOT NULL,
          scheduled_at INTEGER NOT NULL,
          should_notify INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_guild_time ON events(guild_id, scheduled_at);
      `);
    } catch (error) {
      this.logger.Error("Failed to create server tables", { error });
      throw error;
    }
  }

  CreateEvent(data: {
    guild_id: string;
    title: string;
    scheduled_at: number;
    should_notify: boolean;
    created_by: string;
  }): ScheduledEvent {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO events (guild_id, title, scheduled_at, should_notify, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.guild_id,
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
      title: string;
      scheduled_at: number;
      should_notify: number;
      created_by: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      guild_id: row.guild_id,
      title: row.title,
      scheduled_at: row.scheduled_at,
      should_notify: Boolean(row.should_notify),
      created_by: row.created_by,
      created_at: row.created_at,
    }));
  }

  GetEventById(id: number, guild_id: string): ScheduledEvent | null {
    const stmt = this.db.prepare(
      "SELECT * FROM events WHERE id = ? AND guild_id = ?"
    );
    const row = stmt.get(id, guild_id) as
      | {
          id: number;
          guild_id: string;
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
      title: row.title,
      scheduled_at: row.scheduled_at,
      should_notify: Boolean(row.should_notify),
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  DeleteEvent(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM events WHERE id = ? AND guild_id = ?"
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  Close(): void {
    this.db.close();
  }
}
