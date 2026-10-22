import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase blocklist and command channel operations", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-blocklist-"));
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

  it("adds, updates, lists and removes blocklist entries", () => {
    db.AddToBlocklist({
      target_type: "user",
      target_id: "u1",
      reason: "spam",
      created_by: "owner",
    });
    db.AddToBlocklist({
      target_type: "user",
      target_id: "u1",
      reason: "abuse",
      created_by: "owner",
    });
    db.AddToBlocklist({
      target_type: "guild",
      target_id: "g1",
      reason: null,
      created_by: "owner",
    });

    expect(db.GetBlocklistEntry("user", "u1")).toMatchObject({
      reason: "abuse",
    });
    expect(db.GetBlocklistEntry("guild", "u1")).toBeNull();
    expect(db.ListBlocklist()).toHaveLength(2);

    expect(db.RemoveFromBlocklist("user", "u1")).toBe(true);
    expect(db.RemoveFromBlocklist("user", "u1")).toBe(false);
    expect(db.GetBlocklistEntry("user", "u1")).toBeNull();
  });

  it("tracks allowed channels per guild and command", () => {
    expect(db.AddCommandChannel("g1", "meme", "c1")).toBe(true);
    expect(db.AddCommandChannel("g1", "meme", "c1")).toBe(false);
    db.AddCommandChannel("g1", "meme", "c2");
    db.AddCommandChannel("g2", "meme", "c3");

    expect(db.ListCommandChannels("g1", "meme")).toEqual(["c1", "c2"]);
    expect(db.ListCommandChannels("g1", "joke")).toEqual([]);

    expect(db.RemoveCommandChannel("g1", "meme", "c1")).toBe(true);
    expect(db.ListCommandChannels("g1", "meme")).toEqual(["c2"]);

    expect(db.ClearCommandChannels("g1", "meme")).toBe(1);
    expect(db.ListCommandChannels("g1", "meme")).toEqual([]);
    expect(db.ListCommandChannels("g2", "meme")).toEqual(["c3"]);
  });

  it("clears a single command cooldown", () => {
    db.SetCommandCooldownExpiry("u1", "meme", Date.now() + 60_000);
    db.ClearCommandCooldown("u1", "meme");
    expect(db.GetCommandCooldownExpiry("u1", "meme")).toBeUndefined();
  });
});
