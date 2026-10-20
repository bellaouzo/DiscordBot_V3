import type { Migration } from "@database/Migrations/types";

// Baseline schema, frozen. Idempotent so it is a no-op on databases created before
// migrations owned the schema. Never edit it: add a new migration version instead.
const MODERATION_INITIAL_SCHEMA = `
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
`;

export const ModerationMigrations: readonly Migration[] = [
  {
    version: 0,
    name: "initial_schema",
    up(db) {
      db.exec(MODERATION_INITIAL_SCHEMA);
    },
  },
];
