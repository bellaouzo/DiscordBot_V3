import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase raid mode operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-raidmode-"));
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

  it("creates raid mode and gets active mode per guild", () => {
    const raid = db.AddRaidMode({
      guild_id: "guild-1",
      slowmode_seconds: 10,
      expires_at: Date.now() + 60_000,
      applied_by: "mod-1",
    });

    const active = db.GetActiveRaidMode("guild-1");
    expect(active?.id).toBe(raid.id);
    expect(active?.slowmode_seconds).toBe(10);
    expect(active?.active).toBe(true);

    expect(db.GetActiveRaidMode("guild-2")).toBeNull();
  });

  it("lists expired raid modes and clears them", () => {
    const expired = db.AddRaidMode({
      guild_id: "guild-1",
      slowmode_seconds: 5,
      expires_at: Date.now() - 1000,
      applied_by: "mod-1",
    });
    db.AddRaidMode({
      guild_id: "guild-2",
      slowmode_seconds: 5,
      expires_at: Date.now() + 60_000,
      applied_by: "mod-1",
    });

    const expiredList = db.ListExpiredRaidModes(Date.now());
    expect(expiredList).toHaveLength(1);
    expect(expiredList[0].id).toBe(expired.id);

    const cleared = db.MarkRaidModeCleared(expired.id);
    expect(cleared).toBe(true);
    expect(db.GetActiveRaidMode("guild-1")).toBeNull();
  });

  it("stores and clears raid mode channel states", () => {
    const raid = db.AddRaidMode({
      guild_id: "guild-1",
      slowmode_seconds: 15,
      expires_at: null,
      applied_by: "mod-1",
    });

    const channelState = db.AddRaidModeChannelState({
      raid_id: raid.id,
      guild_id: "guild-1",
      channel_id: "channel-1",
      overwrites: "[]",
      rate_limit_per_user: 15,
    });

    const states = db.ListRaidModeChannelStates(raid.id);
    expect(states).toHaveLength(1);
    expect(states[0].channel_id).toBe("channel-1");
    expect(states[0].rate_limit_per_user).toBe(15);
    expect(channelState.id).toBe(states[0].id);

    db.ClearRaidModeChannelStates(raid.id);
    expect(db.ListRaidModeChannelStates(raid.id)).toHaveLength(0);
  });
});
