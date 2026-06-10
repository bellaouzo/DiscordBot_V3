import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase guild settings operations", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-settings-"));
    process.env.DATA_DIR = tempDir;
    db = new ServerDatabase(createMockLogger());
  });

  afterEach(() => {
    db.Close();
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null for unknown guild settings", () => {
    expect(db.GetGuildSettings("unknown-guild")).toBeNull();
  });

  it("upserts and retrieves guild settings with role id round-trip", () => {
    const saved = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["111", "222"],
      mod_role_ids: ["333"],
      ticket_category_id: "cat-1",
    });

    expect(saved.admin_role_ids).toEqual(["111", "222"]);
    expect(saved.mod_role_ids).toEqual(["333"]);
    expect(saved.ticket_category_id).toBe("cat-1");

    const fetched = db.GetGuildSettings("guild-1");
    expect(fetched?.admin_role_ids).toEqual(["111", "222"]);
    expect(fetched?.mod_role_ids).toEqual(["333"]);
  });

  it("normalizes and deduplicates role ids on upsert", () => {
    const saved = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: [" 111 ", "111", "222"],
      mod_role_ids: ["", "333", "333"],
    });

    expect(saved.admin_role_ids).toEqual(["111", "222"]);
    expect(saved.mod_role_ids).toEqual(["333"]);
  });

  it("merges partial upsert and preserves unset fields", () => {
    db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["111"],
      mod_role_ids: ["222"],
      ticket_category_id: "cat-1",
      command_log_channel_id: "log-1",
      announcement_channel_id: "announce-1",
    });

    const updated = db.UpsertGuildSettings({
      guild_id: "guild-1",
      mod_role_ids: ["333"],
      ticket_log_channel_id: "ticket-log-1",
    });

    expect(updated.admin_role_ids).toEqual(["111"]);
    expect(updated.mod_role_ids).toEqual(["333"]);
    expect(updated.ticket_category_id).toBe("cat-1");
    expect(updated.command_log_channel_id).toBe("log-1");
    expect(updated.ticket_log_channel_id).toBe("ticket-log-1");
    expect(updated.announcement_channel_id).toBe("announce-1");
  });

  it("stores and retrieves roblox link fields", () => {
    const linkedAt = Date.now();
    const saved = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: [],
      mod_role_ids: [],
      roblox_linked_discord_user_id: "discord-99",
      roblox_linked_at: linkedAt,
    });

    expect(saved.roblox_linked_discord_user_id).toBe("discord-99");
    expect(saved.roblox_linked_at).toBe(linkedAt);

    const fetched = db.GetGuildSettings("guild-1");
    expect(fetched?.roblox_linked_discord_user_id).toBe("discord-99");
    expect(fetched?.roblox_linked_at).toBe(linkedAt);
  });

  it("keeps existing channel fields when omitted from partial upsert", () => {
    db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: [],
      mod_role_ids: [],
      ticket_category_id: "cat-1",
      welcome_channel_id: "welcome-1",
    });

    const partial = db.UpsertGuildSettings({
      guild_id: "guild-1",
      command_log_channel_id: "log-1",
    });

    expect(partial.ticket_category_id).toBe("cat-1");
    expect(partial.welcome_channel_id).toBe("welcome-1");
    expect(partial.command_log_channel_id).toBe("log-1");
  });

  it("preserves created_at across updates", () => {
    const first = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["111"],
      mod_role_ids: [],
    });

    const second = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["222"],
    });

    expect(second.created_at).toBe(first.created_at);
    expect(second.updated_at).toBeGreaterThanOrEqual(first.updated_at);
  });
});
