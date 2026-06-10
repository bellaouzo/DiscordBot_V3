import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase balance operations", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-balances-"));
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

  it("creates and adjusts balances", () => {
    const created = db.EnsureBalance("user-1", "guild-1", 50);
    expect(created.balance).toBe(50);

    const existing = db.EnsureBalance("user-1", "guild-1", 999);
    expect(existing.balance).toBe(50);

    const adjusted = db.AdjustBalance({
      user_id: "user-1",
      guild_id: "guild-1",
      delta: 25,
    });
    expect(adjusted.balance).toBe(75);
  });

  it("transfers balance between users", () => {
    db.EnsureBalance("user-1", "guild-1", 200);
    db.EnsureBalance("user-2", "guild-1", 50);

    const result = db.TransferBalance({
      from_user_id: "user-1",
      to_user_id: "user-2",
      guild_id: "guild-1",
      amount: 75,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.from.balance).toBe(125);
      expect(result.to.balance).toBe(125);
    }
  });

  it("rejects transfer when sender has insufficient funds", () => {
    db.EnsureBalance("user-1", "guild-1", 50);
    db.EnsureBalance("user-2", "guild-1", 50);

    const result = db.TransferBalance({
      from_user_id: "user-1",
      to_user_id: "user-2",
      guild_id: "guild-1",
      amount: 100,
    });

    expect(result).toEqual({ success: false, reason: "insufficient" });
    expect(db.GetBalance("user-1", "guild-1")?.balance).toBe(50);
    expect(db.GetBalance("user-2", "guild-1")?.balance).toBe(50);
  });

  it("claims daily reward and enforces cooldown", () => {
    const first = db.ClaimDaily({
      user_id: "user-1",
      guild_id: "guild-1",
      reward: 25,
      cooldownMs: 86_400_000,
      startingBalance: 100,
    });

    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.balance.balance).toBe(125);
    }

    const second = db.ClaimDaily({
      user_id: "user-1",
      guild_id: "guild-1",
      reward: 25,
      cooldownMs: 86_400_000,
      startingBalance: 100,
    });

    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.nextAvailableAt).toBeGreaterThan(Date.now());
    }
    expect(db.GetBalance("user-1", "guild-1")?.balance).toBe(125);
  });

  it("returns top balances ordered by amount", () => {
    db.EnsureBalance("user-1", "guild-1", 100);
    db.EnsureBalance("user-2", "guild-1", 300);
    db.EnsureBalance("user-3", "guild-1", 200);

    const top = db.GetTopBalances("guild-1", 2);
    expect(top).toHaveLength(2);
    expect(top[0].userId).toBe("user-2");
    expect(top[0].balance).toBe(300);
    expect(top[1].userId).toBe("user-3");
    expect(top[1].balance).toBe(200);
  });
});
