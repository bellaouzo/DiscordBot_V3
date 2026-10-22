import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase custom tag operations", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-tags-"));
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

  function Create(name: string, content = "x"): void {
    db.CreateCustomTag({ guild_id: "g1", name, content, created_by: "m1" });
  }

  it("creates tags with case-insensitive names", () => {
    Create("Rules", "Be nice");
    expect(db.GetCustomTag("g1", "RULES")).toMatchObject({
      name: "rules",
      content: "Be nice",
      uses: 0,
    });
    expect(db.GetCustomTag("g2", "rules")).toBeNull();
    expect(() => Create("rules")).toThrow();
  });

  it("updates, counts uses, and deletes tags", () => {
    Create("faq", "a");
    expect(
      db.UpdateCustomTagContent({ guild_id: "g1", name: "faq", content: "b" }),
    ).toBe(true);
    db.IncrementCustomTagUses("g1", "faq");
    db.IncrementCustomTagUses("g1", "faq");
    expect(db.GetCustomTag("g1", "faq")).toMatchObject({
      content: "b",
      uses: 2,
    });
    expect(db.CountCustomTags("g1")).toBe(1);
    expect(db.DeleteCustomTag("g1", "faq")).toBe(true);
    expect(db.DeleteCustomTag("g1", "faq")).toBe(false);
  });

  it("searches names with prefix matches first and escapes wildcards", () => {
    ["server-rules", "rules", "roles", "100_percent"].forEach((name) =>
      Create(name),
    );
    expect(db.SearchCustomTagNames("g1", "rul")).toEqual([
      "rules",
      "server-rules",
    ]);
    expect(db.SearchCustomTagNames("g1", "_")).toEqual(["100_percent"]);
    expect(db.SearchCustomTagNames("g1", "", 2)).toHaveLength(2);
  });

  it("stores the new guild settings with defaults", () => {
    const settings = db.UpsertGuildSettings({ guild_id: "g1" });
    expect(settings.spam_filter_enabled).toBe(false);
    expect(settings.tag_prefix).toBe("!");
    expect(
      db.UpsertGuildSettings({ guild_id: "g1", tag_prefix: "?" }).tag_prefix,
    ).toBe("?");
  });
});
