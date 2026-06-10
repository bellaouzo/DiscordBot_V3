import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase warning operations", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-warnings-"));
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

  it("creates, fetches, and lists warnings for a user", () => {
    const first = db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "spam",
    });
    const second = db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-2",
      reason: "toxicity",
    });

    const fetched = db.GetWarningById(first.id, "guild-1");
    expect(fetched?.reason).toBe("spam");
    expect(fetched?.moderator_id).toBe("mod-1");

    const warnings = db.GetWarnings("user-1", "guild-1");
    expect(warnings).toHaveLength(2);
    expect(warnings[0].id).toBe(first.id);
    expect(warnings[1].id).toBe(second.id);
  });

  it("respects guild scoping when fetching warnings by id", () => {
    const warning = db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "rule break",
    });

    expect(db.GetWarningById(warning.id, "guild-1")).not.toBeNull();
    expect(db.GetWarningById(warning.id, "guild-2")).toBeNull();
  });

  it("removes warnings by id and returns the latest warning", () => {
    db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "first",
    });
    const latest = db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-2",
      reason: "second",
    });

    const removedLatest = db.RemoveLatestWarning("user-1", "guild-1");
    expect(removedLatest?.id).toBe(latest.id);
    expect(removedLatest?.reason).toBe("second");
    expect(db.GetWarnings("user-1", "guild-1")).toHaveLength(1);

    const remaining = db.GetWarnings("user-1", "guild-1")[0];
    expect(db.RemoveWarningById(remaining.id, "guild-1")).toBe(true);
    expect(db.RemoveWarningById(remaining.id, "guild-1")).toBe(false);
    expect(db.GetWarnings("user-1", "guild-1")).toHaveLength(0);
  });

  it("stores null reason when none is provided", () => {
    const warning = db.AddWarning({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
    });

    expect(warning.reason).toBeNull();
  });
});
