import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  HasTableColumn,
  RunMigrations,
} from "@database/Migrations/MigrationRunner";
import { ServerMigrations } from "@database/Migrations/server";
import { GuildSettingsStore } from "@database/Server/Stores/GuildSettingsStore";
import { createMockLogger } from "../helpers";

describe("ServerMigrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE guild_settings (
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    const insertMigration = db.prepare(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
    );
    insertMigration.run(1, "guild_settings_columns", Date.now());
    insertMigration.run(2, "events_guild_event_id", Date.now());
    insertMigration.run(3, "events_notified_at", Date.now());
  });

  afterEach(() => {
    db.close();
  });

  it("applies v4 feature flag columns on databases stuck at migration 3", () => {
    expect(HasTableColumn(db, "guild_settings", "economy_enabled")).toBe(false);
    expect(HasTableColumn(db, "guild_settings", "giveaways_enabled")).toBe(
      false,
    );

    RunMigrations(db, ServerMigrations, createMockLogger());

    expect(HasTableColumn(db, "guild_settings", "economy_enabled")).toBe(true);
    expect(HasTableColumn(db, "guild_settings", "giveaways_enabled")).toBe(
      true,
    );

    const applied = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(applied.map((row) => row.version)).toEqual([1, 2, 3, 4]);
  });

  it("allows GuildSettingsStore to read and write after v4 migration", () => {
    RunMigrations(db, ServerMigrations, createMockLogger());

    const store = new GuildSettingsStore(db, createMockLogger());
    const guildId = "guild-123";

    store.UpsertGuildSettings({
      guild_id: guildId,
      admin_role_ids: ["admin"],
      mod_role_ids: ["mod"],
      economy_enabled: false,
      giveaways_enabled: true,
    });

    const settings = store.GetGuildSettings(guildId);

    expect(settings).not.toBeNull();
    expect(settings?.economy_enabled).toBe(false);
    expect(settings?.giveaways_enabled).toBe(true);
  });
});
