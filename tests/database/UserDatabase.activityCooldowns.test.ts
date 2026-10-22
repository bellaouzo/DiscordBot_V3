import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase activity cooldowns", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-activity-"));
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

  function Claim(activity = "work", user = "u1") {
    return db.ClaimActivity({
      user_id: user,
      guild_id: "g1",
      activity,
      cooldownMs: 60_000,
    });
  }

  it("blocks a second claim until the cooldown passes", () => {
    expect(Claim()).toEqual({ success: true });
    const second = Claim();
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.nextAvailableAt).toBeGreaterThan(Date.now());
    }
  });

  it("tracks activities and users independently", () => {
    expect(Claim("work").success).toBe(true);
    expect(Claim("fish").success).toBe(true);
    expect(Claim("work", "u2").success).toBe(true);
  });

  it("releases a claim so it can be used again", () => {
    Claim();
    db.ReleaseActivity("u1", "g1", "work");
    expect(Claim().success).toBe(true);
  });
});
