import Database from "better-sqlite3";
import * as fs from "fs";
import { Logger } from "../Shared/Logger";
import { join } from "path";

export interface Warning {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  reason: string | null;
  created_at: number;
}

export class UserDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = join(process.cwd(), "data");
    const dbPath = join(dataDir, "users.db");

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_warnings_user_guild ON warnings(user_id, guild_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id);
    `);
  }

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
      created_at
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

    if (limit) {
      return stmt.all(user_id, guild_id, limit) as Warning[];
    }

    return stmt.all(user_id, guild_id) as Warning[];
  }

  GetWarningById(id: number, guild_id: string): Warning | null {
    const stmt = this.db.prepare(
      "SELECT * FROM warnings WHERE id = ? AND guild_id = ?"
    );
    return stmt.get(id, guild_id) as Warning | null;
  }

  RemoveWarningById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM warnings WHERE id = ? AND guild_id = ?"
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestWarning(user_id: string, guild_id: string): Warning | null {
    const warning = this.db
      .prepare(
        `
        SELECT * FROM warnings
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(user_id, guild_id) as Warning | null;

    if (!warning) {
      return null;
    }

    const removed = this.RemoveWarningById(warning.id, guild_id);
    return removed ? warning : null;
  }

  Close(): void {
    this.db.close();
  }
}
