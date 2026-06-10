import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase temp action and event operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-temp-actions-"));
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

  it("tracks pending temp actions and active user temp state", () => {
    const expired = db.AddTempAction({
      action: "mute",
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-1",
      reason: "expired mute",
      expires_at: Date.now() - 5_000,
    });
    const active = db.AddTempAction({
      action: "mute",
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-2",
      reason: "active mute",
      expires_at: Date.now() + 120_000,
    });

    const pendingNow = db.GetPendingTempActions({
      guild_id: "guild-1",
      before: Date.now(),
    });
    expect(pendingNow.map((entry) => entry.id)).toContain(expired.id);
    expect(pendingNow.map((entry) => entry.id)).not.toContain(active.id);

    const userActive = db.GetActiveTempActionForUser({
      guild_id: "guild-1",
      user_id: "user-1",
      action: "mute",
    });
    expect(userActive?.id).toBe(active.id);
    expect(userActive?.processed).toBe(false);

    expect(db.MarkTempActionProcessed(active.id)).toBe(true);
    const afterProcessed = db.GetActiveTempActionForUser({
      guild_id: "guild-1",
      user_id: "user-1",
      action: "mute",
    });
    expect(afterProcessed?.id).toBe(expired.id);
  });

  it("counts and removes moderation events with action scoping", () => {
    db.AddModerationEvent({
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-1",
      action: "ban",
      reason: "ban one",
    });
    db.AddModerationEvent({
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-2",
      action: "ban",
      reason: "ban two",
    });
    db.AddModerationEvent({
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-3",
      action: "kick",
      reason: "kick one",
    });

    expect(
      db.CountModerationEvents({
        guild_id: "guild-1",
        user_id: "user-1",
        action: "ban",
      }),
    ).toBe(2);

    const latestBan = db.ListModerationEvents({
      guild_id: "guild-1",
      user_id: "user-1",
      action: "ban",
      limit: 1,
    })[0];
    expect(
      db.RemoveModerationEventById({
        id: latestBan.id,
        guild_id: "guild-1",
        action: "ban",
      }),
    ).toBe(true);
    expect(
      db.CountModerationEvents({
        guild_id: "guild-1",
        user_id: "user-1",
        action: "ban",
      }),
    ).toBe(1);
    expect(
      db.CountModerationEvents({
        guild_id: "guild-1",
        user_id: "user-1",
        action: "kick",
      }),
    ).toBe(1);
  });
});
