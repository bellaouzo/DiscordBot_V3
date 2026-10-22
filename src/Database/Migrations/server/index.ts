import type Database from "better-sqlite3";
import {
  AddTableColumnIfMissing,
  AddTableColumnsIfMissing,
  HasTableColumn,
} from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";
import { GuildSettingColumns } from "@database/Server/GuildSettingsSchema";

// Frozen at v1 — do not add columns here. Add a new migration version instead.
const GUILD_SETTINGS_COLUMNS = new Map<string, "TEXT" | "INTEGER">([
  ["appeal_review_category_id", "TEXT"],
  ["ticket_log_channel_id", "TEXT"],
  ["delete_log_channel_id", "TEXT"],
  ["production_log_channel_id", "TEXT"],
  ["welcome_channel_id", "TEXT"],
  ["roblox_linked_discord_user_id", "TEXT"],
  ["roblox_linked_at", "INTEGER"],
  ["autorole_id", "TEXT"],
  ["starboard_channel_id", "TEXT"],
  ["starboard_emoji", "TEXT"],
  ["starboard_threshold", "INTEGER"],
  ["verification_enabled", "INTEGER"],
  ["unverified_role_id", "TEXT"],
  ["verified_role_id", "TEXT"],
  ["verification_min_account_age_days", "INTEGER"],
  ["verification_channel_id", "TEXT"],
]);

function BackfillGuildEventIds(db: Database.Database): void {
  const guilds = db
    .prepare("SELECT DISTINCT guild_id FROM events")
    .all() as Array<{ guild_id: string }>;

  const selectEvents = db.prepare(
    "SELECT id FROM events WHERE guild_id = ? ORDER BY scheduled_at ASC, id ASC",
  );
  const updateEvent = db.prepare(
    "UPDATE events SET guild_event_id = ? WHERE id = ?",
  );

  const transaction = db.transaction(() => {
    guilds.forEach((guild) => {
      const events = selectEvents.all(guild.guild_id) as Array<{ id: number }>;
      events.forEach((event, index) => {
        updateEvent.run(index + 1, event.id);
      });
    });
  });

  transaction();
}

// Baseline schema, frozen. Idempotent so it is a no-op on databases created before
// migrations owned the schema. Never edit it: add a new migration version instead.
const SERVER_INITIAL_SCHEMA = `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      guild_event_id INTEGER,
      title TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      should_notify INTEGER DEFAULT 0,
      notified_at INTEGER,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_guild_time ON events(guild_id, scheduled_at);

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      admin_role_ids TEXT NOT NULL,
      mod_role_ids TEXT NOT NULL,
      ticket_category_id TEXT,
      appeal_review_category_id TEXT,
      command_log_channel_id TEXT,
      ticket_log_channel_id TEXT,
      announcement_channel_id TEXT,
      delete_log_channel_id TEXT,
      production_log_channel_id TEXT,
      welcome_channel_id TEXT,
      autorole_id TEXT,
      starboard_channel_id TEXT,
      starboard_emoji TEXT,
      starboard_threshold INTEGER,
      roblox_linked_discord_user_id TEXT,
      roblox_linked_at INTEGER,
      verification_enabled INTEGER,
      unverified_role_id TEXT,
      verified_role_id TEXT,
      verification_min_account_age_days INTEGER,
      verification_channel_id TEXT,
      economy_enabled INTEGER,
      giveaways_enabled INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guild_settings_updated ON guild_settings(updated_at);

    CREATE TABLE IF NOT EXISTS command_cooldowns (
      user_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, command_name)
    );

    CREATE INDEX IF NOT EXISTS idx_command_cooldowns_expires ON command_cooldowns(expires_at);

    CREATE TABLE IF NOT EXISTS guild_xp_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      xp_per_message INTEGER NOT NULL DEFAULT 15,
      cooldown_seconds INTEGER NOT NULL DEFAULT 60,
      min_message_length INTEGER NOT NULL DEFAULT 5,
      daily_cap INTEGER NOT NULL DEFAULT 500,
      excluded_channel_ids TEXT NOT NULL DEFAULT '[]',
      level_up_channel_id TEXT
    );

    CREATE TABLE IF NOT EXISTS reaction_role_panels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(guild_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS reaction_role_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      panel_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      UNIQUE(panel_id, emoji),
      FOREIGN KEY (panel_id) REFERENCES reaction_role_panels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS starboard_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      source_channel_id TEXT NOT NULL,
      source_message_id TEXT NOT NULL,
      starboard_message_id TEXT NOT NULL,
      star_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(guild_id, source_message_id)
    );

    CREATE TABLE IF NOT EXISTS level_role_rewards (
      guild_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, level)
    );

    CREATE TABLE IF NOT EXISTS guild_disabled_commands (
      guild_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      PRIMARY KEY (guild_id, command_name)
    );
`;

export const ServerMigrations: readonly Migration[] = [
  {
    version: 0,
    name: "initial_schema",
    up(db) {
      db.exec(SERVER_INITIAL_SCHEMA);
    },
  },
  {
    version: 1,
    name: "guild_settings_columns",
    up(db) {
      AddTableColumnsIfMissing(db, "guild_settings", [
        ...GUILD_SETTINGS_COLUMNS.entries(),
      ]);
    },
  },
  {
    version: 2,
    name: "events_guild_event_id",
    up(db) {
      if (HasTableColumn(db, "events", "guild_event_id")) {
        return;
      }

      db.prepare("ALTER TABLE events ADD COLUMN guild_event_id INTEGER").run();
      BackfillGuildEventIds(db);
    },
  },
  {
    version: 3,
    name: "events_notified_at",
    up(db) {
      AddTableColumnIfMissing(db, "events", "notified_at", "INTEGER");
    },
  },
  {
    version: 4,
    name: "guild_settings_feature_flags",
    up(db) {
      AddTableColumnsIfMissing(db, "guild_settings", [
        ["economy_enabled", "INTEGER"],
        ["giveaways_enabled", "INTEGER"],
      ]);
    },
  },
  {
    version: 5,
    name: "custom_tags_and_spam_filter_flag",
    up(db) {
      AddTableColumnsIfMissing(
        db,
        "guild_settings",
        GuildSettingColumns(["spam_filter_enabled", "tag_prefix"]),
      );
      db.exec(`
        CREATE TABLE IF NOT EXISTS custom_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_by TEXT NOT NULL,
          uses INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(guild_id, name)
        );
      `);
    },
  },
  {
    version: 6,
    name: "bot_blocklist_and_command_channels",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS bot_blocklist (
          target_type TEXT NOT NULL CHECK (target_type IN ('user', 'guild')),
          target_id TEXT NOT NULL,
          reason TEXT,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (target_type, target_id)
        );

        CREATE TABLE IF NOT EXISTS guild_command_channels (
          guild_id TEXT NOT NULL,
          command_name TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          PRIMARY KEY (guild_id, command_name, channel_id)
        );
      `);
    },
  },
];
