import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { SPAM_FILTER_DEFAULTS } from "@database/Moderation/Types";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase spam filter operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-spam-"));
    process.env.DATA_DIR = tempDir;
    db = new ModerationDatabase(createMockLogger());
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

  it("returns defaults for unconfigured guilds", () => {
    expect(db.GetSpamFilterSettings("g1")).toEqual({
      guild_id: "g1",
      ...SPAM_FILTER_DEFAULTS,
    });
  });

  it("merges partial settings updates", () => {
    db.UpsertSpamFilterSettings({ guild_id: "g1", max_messages: 10 });
    db.UpsertSpamFilterSettings({ guild_id: "g1", exempt_channel_ids: ["c1"] });
    expect(db.GetSpamFilterSettings("g1")).toMatchObject({
      max_messages: 10,
      exempt_channel_ids: ["c1"],
      window_seconds: SPAM_FILTER_DEFAULTS.window_seconds,
    });
  });

  it("counts, lists and clears strikes per member", () => {
    db.AddSpamStrike({
      guild_id: "g1",
      user_id: "u1",
      reason: "flood",
      action: "warn",
    });
    db.AddSpamStrike({
      guild_id: "g1",
      user_id: "u1",
      reason: "dupes",
      action: "timeout",
      duration_ms: 600_000,
    });
    db.AddSpamStrike({
      guild_id: "g1",
      user_id: "u2",
      reason: "flood",
      action: "warn",
    });

    expect(
      db.CountSpamStrikesSince({ guild_id: "g1", user_id: "u1", since: 0 }),
    ).toBe(2);
    expect(
      db.CountSpamStrikesSince({
        guild_id: "g1",
        user_id: "u1",
        since: Date.now() + 1000,
      }),
    ).toBe(0);
    expect(db.ListSpamStrikes("g1", "u1")[0]).toMatchObject({
      action: "timeout",
      duration_ms: 600_000,
    });
    expect(db.ClearSpamStrikes("g1", "u1")).toBe(2);
    expect(db.ListSpamStrikes("g1", "u2")).toHaveLength(1);
  });
});
