import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase migrations", () => {
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-migrations-"));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("backfills guild_event_id for legacy events without column", () => {
    const dbPath = join(tempDir, "server.db");
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        title TEXT NOT NULL,
        scheduled_at INTEGER NOT NULL,
        should_notify INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        admin_role_ids TEXT NOT NULL,
        mod_role_ids TEXT NOT NULL,
        ticket_category_id TEXT,
        command_log_channel_id TEXT,
        announcement_channel_id TEXT,
        delete_log_channel_id TEXT,
        production_log_channel_id TEXT,
        welcome_channel_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO events (guild_id, title, scheduled_at, should_notify, created_by, created_at)
      VALUES ('guild-1', 'Legacy A', 1000, 0, 'user-1', 1000),
             ('guild-1', 'Legacy B', 2000, 0, 'user-1', 2000),
             ('guild-2', 'Other', 3000, 0, 'user-2', 3000);
    `);
    legacyDb.close();

    const db = new ServerDatabase(createMockLogger());
    const guildOne = db.ListUpcomingEvents("guild-1", 0);
    const guildTwo = db.ListUpcomingEvents("guild-2", 0);

    expect(guildOne[0].guild_event_id).toBe(1);
    expect(guildOne[1].guild_event_id).toBe(2);
    expect(guildTwo[0].guild_event_id).toBe(1);

    db.Close();
  });

  it("adds missing guild settings columns on startup", () => {
    const dbPath = join(tempDir, "server.db");
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        admin_role_ids TEXT NOT NULL,
        mod_role_ids TEXT NOT NULL,
        ticket_category_id TEXT,
        command_log_channel_id TEXT,
        announcement_channel_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    legacyDb.close();

    const db = new ServerDatabase(createMockLogger());
    const saved = db.UpsertGuildSettings({
      guild_id: "guild-1",
      appeal_review_category_id: "appeal-cat",
      roblox_linked_discord_user_id: "discord-1",
      roblox_linked_at: 12345,
    });

    expect(saved.appeal_review_category_id).toBe("appeal-cat");
    expect(saved.roblox_linked_discord_user_id).toBe("discord-1");
    expect(saved.roblox_linked_at).toBe(12345);

    db.Close();
  });
});
