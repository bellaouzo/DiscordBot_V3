import Database from "better-sqlite3";
import * as fs from "fs";
import { join } from "path";
import { Logger } from "@shared/Logger";

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

export type LinkFilterType = "allow" | "block";

export interface LinkFilter {
  id: number;
  guild_id: string;
  pattern: string;
  type: LinkFilterType;
  created_by: string;
  created_at: number;
}

export interface RaidMode {
  id: number;
  guild_id: string;
  slowmode_seconds: number;
  expires_at: number | null;
  applied_by: string;
  applied_at: number;
  cleared_at: number | null;
  active: boolean;
}

export interface RaidModeChannelState {
  id: number;
  raid_id: number;
  guild_id: string;
  channel_id: string;
  overwrites: string;
  rate_limit_per_user: number;
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

  private MapLinkFilter(row: Record<string, unknown>): LinkFilter {
    return {
      id: Number(row.id),
      guild_id: String(row.guild_id),
      pattern: String(row.pattern),
      type: row.type as LinkFilterType,
      created_by: String(row.created_by),
      created_at: Number(row.created_at),
    };
  }

  private MapRaidMode(row: Record<string, unknown>): RaidMode {
    return {
      id: Number(row.id),
      guild_id: String(row.guild_id),
      slowmode_seconds: Number(row.slowmode_seconds),
      expires_at: row.expires_at ? Number(row.expires_at) : null,
      applied_by: String(row.applied_by),
      applied_at: Number(row.applied_at),
      cleared_at: row.cleared_at ? Number(row.cleared_at) : null,
      active: Boolean(row.active),
    };
  }

  private MapRaidModeChannel(
    row: Record<string, unknown>
  ): RaidModeChannelState {
    return {
      id: Number(row.id),
      raid_id: Number(row.raid_id),
      guild_id: String(row.guild_id),
      channel_id: String(row.channel_id),
      overwrites: String(row.overwrites),
      rate_limit_per_user: Number(row.rate_limit_per_user),
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

        CREATE TABLE IF NOT EXISTS link_filters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          pattern TEXT NOT NULL,
          type TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_link_filters_unique ON link_filters(guild_id, pattern, type);
        CREATE INDEX IF NOT EXISTS idx_link_filters_guild ON link_filters(guild_id);

        CREATE TABLE IF NOT EXISTS raid_modes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          slowmode_seconds INTEGER NOT NULL,
          expires_at INTEGER,
          applied_by TEXT NOT NULL,
          applied_at INTEGER NOT NULL,
          cleared_at INTEGER,
          active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS raid_mode_channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          raid_id INTEGER NOT NULL,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          overwrites TEXT NOT NULL,
          rate_limit_per_user INTEGER NOT NULL,
          FOREIGN KEY (raid_id) REFERENCES raid_modes(id) ON DELETE CASCADE
        );

        -- Replace old unique index (active across all states) with partial unique on active=1
        DROP INDEX IF EXISTS idx_raid_mode_active;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_mode_active ON raid_modes(guild_id) WHERE active = 1;
        CREATE INDEX IF NOT EXISTS idx_raid_mode_expires ON raid_modes(expires_at);
        CREATE INDEX IF NOT EXISTS idx_raid_mode_channels_raid ON raid_mode_channels(raid_id);
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

  AddLinkFilter(data: {
    guild_id: string;
    pattern: string;
    type: LinkFilterType;
    created_by: string;
  }): LinkFilter {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO link_filters (guild_id, pattern, type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const normalizedPattern = data.pattern.trim().toLowerCase();
    const id = stmt.run(
      data.guild_id,
      normalizedPattern,
      data.type,
      data.created_by,
      created_at
    ).lastInsertRowid as number;

    const record = this.GetLinkFilterById(id);
    if (!record) {
      throw new Error("Failed to create link filter");
    }

    return record;
  }

  GetLinkFilterById(id: number): LinkFilter | null {
    const stmt = this.db.prepare("SELECT * FROM link_filters WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.MapLinkFilter(row) : null;
  }

  ListLinkFilters(guild_id: string): LinkFilter[] {
    const stmt = this.db.prepare(
      "SELECT * FROM link_filters WHERE guild_id = ? ORDER BY created_at DESC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapLinkFilter(row));
  }

  RemoveLinkFilter(data: {
    guild_id: string;
    pattern: string;
    type: LinkFilterType;
  }): boolean {
    const normalizedPattern = data.pattern.trim().toLowerCase();
    const stmt = this.db.prepare(
      "DELETE FROM link_filters WHERE guild_id = ? AND pattern = ? AND type = ?"
    );
    const result = stmt.run(data.guild_id, normalizedPattern, data.type);
    return result.changes > 0;
  }

  AddRaidMode(data: {
    guild_id: string;
    slowmode_seconds: number;
    expires_at: number | null;
    applied_by: string;
  }): RaidMode {
    const applied_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO raid_modes (guild_id, slowmode_seconds, expires_at, applied_by, applied_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const id = stmt.run(
      data.guild_id,
      data.slowmode_seconds,
      data.expires_at,
      data.applied_by,
      applied_at
    ).lastInsertRowid as number;

    const record = this.GetRaidModeById(id);
    if (!record) {
      throw new Error("Failed to create raid mode");
    }

    return record;
  }

  GetRaidModeById(id: number): RaidMode | null {
    const stmt = this.db.prepare("SELECT * FROM raid_modes WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.MapRaidMode(row) : null;
  }

  GetActiveRaidMode(guild_id: string): RaidMode | null {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE guild_id = ? AND active = 1"
    );
    const row = stmt.get(guild_id) as Record<string, unknown> | undefined;
    return row ? this.MapRaidMode(row) : null;
  }

  ListExpiredRaidModes(before: number): RaidMode[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?"
    );
    const rows = stmt.all(before) as Record<string, unknown>[];
    return rows.map((row) => this.MapRaidMode(row));
  }

  MarkRaidModeCleared(id: number): boolean {
    const cleared_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE raid_modes SET active = 0, cleared_at = ? WHERE id = ?"
    );
    const result = stmt.run(cleared_at, id);
    return result.changes > 0;
  }

  AddRaidModeChannelState(data: {
    raid_id: number;
    guild_id: string;
    channel_id: string;
    overwrites: string;
    rate_limit_per_user: number;
  }): RaidModeChannelState {
    const stmt = this.db.prepare(`
      INSERT INTO raid_mode_channels (raid_id, guild_id, channel_id, overwrites, rate_limit_per_user)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.raid_id,
      data.guild_id,
      data.channel_id,
      data.overwrites,
      data.rate_limit_per_user
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM raid_mode_channels WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Failed to create raid mode channel state");
    }
    return this.MapRaidModeChannel(row);
  }

  ListRaidModeChannelStates(raid_id: number): RaidModeChannelState[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_mode_channels WHERE raid_id = ?"
    );
    const rows = stmt.all(raid_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapRaidModeChannel(row));
  }

  ClearRaidModeChannelStates(raid_id: number): void {
    const stmt = this.db.prepare(
      "DELETE FROM raid_mode_channels WHERE raid_id = ?"
    );
    stmt.run(raid_id);
  }

  Close(): void {
    this.db.close();
  }
}
