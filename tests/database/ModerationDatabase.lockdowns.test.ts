import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase lockdown operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-lockdowns-"));
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

  it("creates and fetches lockdown by id", () => {
    const lockdown = db.AddLockdown({
      scope: "channel",
      guild_id: "guild-1",
      target_id: "channel-1",
      applied_by: "mod-1",
      overwrites: "[]",
    });

    const fetched = db.GetLockdownById(lockdown.id);
    expect(fetched?.scope).toBe("channel");
    expect(fetched?.target_id).toBe("channel-1");
    expect(fetched?.active).toBe(true);
  });

  it("gets active lockdown for scope and target", () => {
    db.AddLockdown({
      scope: "category",
      guild_id: "guild-1",
      target_id: "category-1",
      applied_by: "mod-1",
      overwrites: "[]",
    });

    const active = db.GetActiveLockdown("category", "guild-1", "category-1");
    expect(active?.target_id).toBe("category-1");

    const missing = db.GetActiveLockdown("category", "guild-1", "category-2");
    expect(missing).toBeNull();
  });

  it("lists active lockdowns and marks lifted", () => {
    const first = db.AddLockdown({
      scope: "channel",
      guild_id: "guild-1",
      target_id: "channel-1",
      applied_by: "mod-1",
      overwrites: "[]",
    });
    db.AddLockdown({
      scope: "channel",
      guild_id: "guild-1",
      target_id: "channel-2",
      applied_by: "mod-1",
      overwrites: "[]",
    });

    expect(db.ListActiveLockdowns("guild-1")).toHaveLength(2);

    const lifted = db.MarkLockdownLifted(first.id);
    expect(lifted).toBe(true);

    const active = db.ListActiveLockdowns("guild-1");
    expect(active).toHaveLength(1);
    expect(active[0].target_id).toBe("channel-2");

    const inactive = db.GetLockdownById(first.id);
    expect(inactive?.active).toBe(false);
    expect(inactive?.lifted_at).not.toBeNull();
  });
});
