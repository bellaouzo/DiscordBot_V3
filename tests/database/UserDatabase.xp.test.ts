import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase xp operations", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-xp-"));
    process.env.DATA_DIR = tempDir;
    db = new UserDatabase(createMockLogger());
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

  it("creates default xp record for a user", () => {
    const created = db.EnsureUserXp("user-1", "guild-1");
    expect(created.xp).toBe(0);
    expect(created.level).toBe(1);
    expect(created.total_xp_earned).toBe(0);

    const existing = db.EnsureUserXp("user-1", "guild-1");
    expect(existing.user_id).toBe(created.user_id);
    expect(existing.level).toBe(1);
  });

  it("adds xp and levels up when threshold is reached", () => {
    db.EnsureUserXp("user-1", "guild-1");
    const xpForLevel1 = db.GetXpForNextLevel(1);

    const result = db.AddXp({
      user_id: "user-1",
      guild_id: "guild-1",
      amount: xpForLevel1,
    });

    expect(result.leveledUp).toBe(true);
    expect(result.previousLevel).toBe(1);
    expect(result.userXp.level).toBe(2);
    expect(result.userXp.xp).toBe(0);
    expect(result.userXp.total_xp_earned).toBe(xpForLevel1);
  });

  it("accumulates partial xp without leveling", () => {
    db.EnsureUserXp("user-1", "guild-1");

    const result = db.AddXp({
      user_id: "user-1",
      guild_id: "guild-1",
      amount: 40,
    });

    expect(result.leveledUp).toBe(false);
    expect(result.userXp.level).toBe(1);
    expect(result.userXp.xp).toBe(40);
    expect(result.userXp.total_xp_earned).toBe(40);
  });

  it("returns xp leaderboard ordered by level and xp", () => {
    db.EnsureUserXp("user-1", "guild-1");
    db.EnsureUserXp("user-2", "guild-1");
    db.EnsureUserXp("user-3", "guild-1");

    db.AddXp({ user_id: "user-1", guild_id: "guild-1", amount: 50 });
    db.AddXp({ user_id: "user-2", guild_id: "guild-1", amount: 200 });
    db.AddXp({ user_id: "user-3", guild_id: "guild-1", amount: 150 });

    const leaderboard = db.GetXpLeaderboard("guild-1", 3);
    expect(leaderboard[0].userId).toBe("user-2");
    expect(leaderboard[0].level).toBe(2);
    expect(leaderboard[1].userId).toBe("user-3");
    expect(leaderboard[2].userId).toBe("user-1");
  });
});
