import type Database from "better-sqlite3";
import {
  AddTableColumnIfMissing,
  AddTableColumnsIfMissing,
  HasTableColumn,
} from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";

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

export const ServerMigrations: readonly Migration[] = [
  {
    version: 1,
    name: "guild_settings_columns",
    up(db) {
      AddTableColumnsIfMissing(
        db,
        "guild_settings",
        [...GUILD_SETTINGS_COLUMNS.entries()],
      );
    },
  },
  {
    version: 2,
    name: "events_guild_event_id",
    up(db) {
      if (HasTableColumn(db, "events", "guild_event_id")) {
        return;
      }

      db.prepare(
        "ALTER TABLE events ADD COLUMN guild_event_id INTEGER",
      ).run();
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
];
