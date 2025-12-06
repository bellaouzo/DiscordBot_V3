import Database from "better-sqlite3";
import * as fs from "fs";
import { join } from "path";
import { Logger } from "../Shared/Logger";

export type TempActionType = "ban" | "mute";

export interface TempAction {
  id: number;
  action: TempActionType;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string | null;
  expires_at: number;
  processed: boolean;
  created_at: number;
  updated_at: number;
}

export type LockdownScope = "channel" | "category";

export interface Lockdown {
  id: number;
  scope: LockdownScope;
  guild_id: string;
  target_id: string;
  applied_by: string;
  applied_at: number;
  lifted_at: number | null;
  active: boolean;
  overwrites: string;
}

export class ModerationDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private MapTempAction(row: Record<string, unknown>): TempAction {
    return {
      id: Number(row.id),
      action: row.action as TempActionType,
      guild_id: String(row.guild_id),
      user_id: String(row.user_id),
      moderator_id: String(row.moderator_id),
      reason: row.reason ? String(row.reason) : null,
      expires_at: Number(row.expires_at),
      processed: Boolean(row.processed),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };
  }

  private MapLockdown(row: Record<string, unknown>): Lockdown {
    return {
      id: Number(row.id),
      scope: row.scope as LockdownScope,
      guild_id: String(row.guild_id),
      target_id: String(row.target_id),
      applied_by: String(row.applied_by),
      applied_at: Number(row.applied_at),
      lifted_at: row.lifted_at ? Number(row.lifted_at) : null,
      active: Boolean(row.active),
      overwrites: String(row.overwrites),
    };
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = join(process.cwd(), "data");
    const dbPath = join(dataDir, "moderation.db");

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize moderation database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS temp_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT,
          expires_at INTEGER NOT NULL,
          processed INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_temp_actions_guild_processed ON temp_actions(guild_id, processed);
        CREATE INDEX IF NOT EXISTS idx_temp_actions_expires ON temp_actions(expires_at);

        CREATE TABLE IF NOT EXISTS lockdowns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          applied_by TEXT NOT NULL,
          applied_at INTEGER NOT NULL,
          lifted_at INTEGER,
          active INTEGER DEFAULT 1,
          overwrites TEXT NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_lockdowns_active_target ON lockdowns(scope, guild_id, target_id, active);
        CREATE INDEX IF NOT EXISTS idx_lockdowns_guild ON lockdowns(guild_id);
      `);
    } catch (error) {
      this.logger.Error("Failed to create moderation tables", { error });
      throw error;
    }
  }

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
      created_at
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
    return row ? this.MapTempAction(row) : null;
  }

  GetPendingTempActions(options?: {
    guild_id?: string;
    before?: number;
  }): TempAction[] {
    const cutoff = options?.before ?? Number.MAX_SAFE_INTEGER;

    if (options?.guild_id) {
      const stmt = this.db.prepare(
        "SELECT * FROM temp_actions WHERE processed = 0 AND guild_id = ? AND expires_at <= ? ORDER BY expires_at ASC"
      );
      const rows = stmt.all(options.guild_id, cutoff) as Record<
        string,
        unknown
      >[];
      return rows.map((row) => this.MapTempAction(row));
    }

    const stmt = this.db.prepare(
      "SELECT * FROM temp_actions WHERE processed = 0 AND expires_at <= ? ORDER BY expires_at ASC"
    );
    const rows = stmt.all(cutoff) as Record<string, unknown>[];
    return rows.map((row) => this.MapTempAction(row));
  }

  ListPendingTempActions(guild_id: string): TempAction[] {
    const stmt = this.db.prepare(
      "SELECT * FROM temp_actions WHERE processed = 0 AND guild_id = ? ORDER BY expires_at ASC"
    );

    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTempAction(row));
  }

  MarkTempActionProcessed(id: number): boolean {
    const updated_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE temp_actions SET processed = 1, updated_at = ? WHERE id = ?"
    );
    const result = stmt.run(updated_at, id);
    return result.changes > 0;
  }

  AddLockdown(data: {
    scope: LockdownScope;
    guild_id: string;
    target_id: string;
    applied_by: string;
    overwrites: string;
  }): Lockdown {
    const applied_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO lockdowns (scope, guild_id, target_id, applied_by, applied_at, overwrites, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const id = stmt.run(
      data.scope,
      data.guild_id,
      data.target_id,
      data.applied_by,
      applied_at,
      data.overwrites
    ).lastInsertRowid as number;

    const record = this.GetLockdownById(id);
    if (!record) {
      throw new Error("Failed to create lockdown record");
    }

    return record;
  }

  GetLockdownById(id: number): Lockdown | null {
    const stmt = this.db.prepare("SELECT * FROM lockdowns WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.MapLockdown(row) : null;
  }

  GetActiveLockdown(
    scope: LockdownScope,
    guild_id: string,
    target_id: string
  ): Lockdown | null {
    const stmt = this.db.prepare(
      "SELECT * FROM lockdowns WHERE scope = ? AND guild_id = ? AND target_id = ? AND active = 1"
    );
    const row = stmt.get(scope, guild_id, target_id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.MapLockdown(row) : null;
  }

  ListActiveLockdowns(guild_id: string): Lockdown[] {
    const stmt = this.db.prepare(
      "SELECT * FROM lockdowns WHERE guild_id = ? AND active = 1 ORDER BY applied_at DESC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapLockdown(row));
  }

  MarkLockdownLifted(id: number): boolean {
    const lifted_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE lockdowns SET active = 0, lifted_at = ? WHERE id = ?"
    );
    const result = stmt.run(lifted_at, id);
    return result.changes > 0;
  }

  Close(): void {
    this.db.close();
  }
}
