import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import { Logger } from "@shared/Logger";
import {
  MapLinkFilter,
  MapLockdown,
  MapRaidMode,
  MapRaidModeChannel,
} from "@database/Moderation/Mappers";
import {
  Appeal,
  AppealActionType,
  AppealStatus,
  LinkFilter,
  LinkFilterType,
  Lockdown,
  LockdownScope,
  RaidMode,
  RaidModeChannelState,
  TempAction,
  TempActionType,
} from "@database/Moderation/Types";
import { TempActionStore } from "@database/Moderation/Stores/TempActionStore";
import { ModerationEventStore } from "@database/Moderation/Stores/ModerationEventStore";
import { AppealStore } from "@database/Moderation/Stores/AppealStore";

export type {
  Appeal,
  AppealActionType,
  AppealStatus,
  LinkFilter,
  LinkFilterType,
  Lockdown,
  LockdownScope,
  RaidMode,
  RaidModeChannelState,
  TempAction,
  TempActionType,
} from "@database/Moderation/Types";

export class ModerationDatabase {
  private readonly db: Database.Database;
  private readonly tempActions: TempActionStore;
  private readonly moderationEvents: ModerationEventStore;
  private readonly appeals: AppealStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.tempActions = new TempActionStore(this.db);
    this.moderationEvents = new ModerationEventStore(this.db);
    this.appeals = new AppealStore(this.db);
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "moderation.db");

    try {
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

        CREATE TABLE IF NOT EXISTS moderation_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT,
          duration_ms INTEGER,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_mod_events_user ON moderation_events(guild_id, user_id, action);
        CREATE INDEX IF NOT EXISTS idx_mod_events_created ON moderation_events(created_at);

        CREATE TABLE IF NOT EXISTS appeals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_ref TEXT,
          reason TEXT NOT NULL,
          evidence TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          review_channel_id TEXT,
          review_message_id TEXT,
          resolved_by TEXT,
          resolved_reason TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          resolved_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_appeals_guild_status ON appeals(guild_id, status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(guild_id, user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_appeals_action ON appeals(guild_id, action_type, action_ref);
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
    return this.tempActions.AddTempAction(data);
  }

  GetTempActionById(id: number): TempAction | null {
    return this.tempActions.GetTempActionById(id);
  }

  GetPendingTempActions(options?: {
    guild_id?: string;
    before?: number;
  }): TempAction[] {
    return this.tempActions.GetPendingTempActions(options);
  }

  ListPendingTempActions(guild_id: string): TempAction[] {
    return this.tempActions.ListPendingTempActions(guild_id);
  }

  MarkTempActionProcessed(id: number): boolean {
    return this.tempActions.MarkTempActionProcessed(id);
  }

  RemoveTempActionById(id: number): boolean {
    return this.tempActions.RemoveTempActionById(id);
  }

  GetActiveTempActionForUser(options: {
    guild_id: string;
    user_id: string;
    action: TempActionType;
  }): TempAction | null {
    return this.tempActions.GetActiveTempActionForUser(options);
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
    return row ? MapLockdown(row) : null;
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
    return row ? MapLockdown(row) : null;
  }

  ListActiveLockdowns(guild_id: string): Lockdown[] {
    const stmt = this.db.prepare(
      "SELECT * FROM lockdowns WHERE guild_id = ? AND active = 1 ORDER BY applied_at DESC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapLockdown(row));
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
    return row ? MapLinkFilter(row) : null;
  }

  ListLinkFilters(guild_id: string): LinkFilter[] {
    const stmt = this.db.prepare(
      "SELECT * FROM link_filters WHERE guild_id = ? ORDER BY created_at DESC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapLinkFilter(row));
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
    return row ? MapRaidMode(row) : null;
  }

  GetActiveRaidMode(guild_id: string): RaidMode | null {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE guild_id = ? AND active = 1"
    );
    const row = stmt.get(guild_id) as Record<string, unknown> | undefined;
    return row ? MapRaidMode(row) : null;
  }

  ListExpiredRaidModes(before: number): RaidMode[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?"
    );
    const rows = stmt.all(before) as Record<string, unknown>[];
    return rows.map((row) => MapRaidMode(row));
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
    return MapRaidModeChannel(row);
  }

  ListRaidModeChannelStates(raid_id: number): RaidModeChannelState[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_mode_channels WHERE raid_id = ?"
    );
    const rows = stmt.all(raid_id) as Record<string, unknown>[];
    return rows.map((row) => MapRaidModeChannel(row));
  }

  ClearRaidModeChannelStates(raid_id: number): void {
    const stmt = this.db.prepare(
      "DELETE FROM raid_mode_channels WHERE raid_id = ?"
    );
    stmt.run(raid_id);
  }

  AddModerationEvent(data: {
    guild_id: string;
    user_id: string;
    moderator_id: string;
    action: "kick" | "ban";
    reason?: string | null;
    duration_ms?: number | null;
  }): void {
    this.moderationEvents.AddModerationEvent(data);
  }

  ListModerationEvents(options: {
    guild_id: string;
    user_id: string;
    action: "kick" | "ban";
    limit?: number;
  }): {
    id: number;
    guild_id: string;
    user_id: string;
    moderator_id: string;
    action: "kick" | "ban";
    reason: string | null;
    duration_ms: number | null;
    created_at: number;
  }[] {
    return this.moderationEvents.ListModerationEvents(options);
  }

  CountModerationEvents(options: {
    guild_id: string;
    user_id: string;
    action: "kick" | "ban";
  }): number {
    return this.moderationEvents.CountModerationEvents(options);
  }

  RemoveModerationEventById(data: {
    id: number;
    guild_id: string;
    action?: "kick" | "ban";
  }): boolean {
    return this.moderationEvents.RemoveModerationEventById(data);
  }

  ListUserTempActions(options: {
    guild_id: string;
    user_id: string;
    action: TempActionType;
    limit?: number;
  }): TempAction[] {
    return this.tempActions.ListUserTempActions(options);
  }

  AddAppeal(data: {
    guild_id: string;
    user_id: string;
    action_type: AppealActionType;
    action_ref?: string | null;
    reason: string;
    evidence?: string | null;
    review_channel_id?: string | null;
    review_message_id?: string | null;
  }): Appeal {
    return this.appeals.AddAppeal(data);
  }

  GetAppealById(id: number): Appeal | null {
    return this.appeals.GetAppealById(id);
  }

  ListAppeals(options: {
    guild_id: string;
    user_id?: string;
    status?: AppealStatus;
    action_type?: AppealActionType;
    limit?: number;
  }): Appeal[] {
    return this.appeals.ListAppeals(options);
  }

  UpdateAppealReviewMessage(data: {
    id: number;
    review_channel_id: string;
    review_message_id: string;
  }): boolean {
    return this.appeals.UpdateAppealReviewMessage(data);
  }

  ResolveAppeal(data: {
    id: number;
    status: Exclude<AppealStatus, "open">;
    resolved_by: string;
    resolved_reason?: string | null;
  }): Appeal | null {
    return this.appeals.ResolveAppeal(data);
  }

  Close(): void {
    this.db.close();
  }
}
