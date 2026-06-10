import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase link filter operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-linkfilters-"));
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

  it("creates link filter with normalized pattern", () => {
    const filter = db.AddLinkFilter({
      guild_id: "guild-1",
      pattern: "  Example.COM ",
      type: "block",
      created_by: "mod-1",
    });

    expect(filter.pattern).toBe("example.com");
    expect(filter.type).toBe("block");
  });

  it("lists link filters for guild", () => {
    db.AddLinkFilter({
      guild_id: "guild-1",
      pattern: "bad.com",
      type: "block",
      created_by: "mod-1",
    });
    db.AddLinkFilter({
      guild_id: "guild-1",
      pattern: "spam",
      type: "allow",
      created_by: "mod-2",
    });
    db.AddLinkFilter({
      guild_id: "guild-2",
      pattern: "other.com",
      type: "block",
      created_by: "mod-1",
    });

    const guildFilters = db.ListLinkFilters("guild-1");
    expect(guildFilters).toHaveLength(2);
    expect(guildFilters.map((f) => f.pattern)).toEqual(
      expect.arrayContaining(["bad.com", "spam"]),
    );
  });

  it("removes link filter by pattern and type", () => {
    db.AddLinkFilter({
      guild_id: "guild-1",
      pattern: "Remove.Me",
      type: "block",
      created_by: "mod-1",
    });

    const removed = db.RemoveLinkFilter({
      guild_id: "guild-1",
      pattern: "remove.me",
      type: "block",
    });
    expect(removed).toBe(true);
    expect(db.ListLinkFilters("guild-1")).toHaveLength(0);

    const missing = db.RemoveLinkFilter({
      guild_id: "guild-1",
      pattern: "nope",
      type: "block",
    });
    expect(missing).toBe(false);
  });
});
