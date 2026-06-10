import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase note operations", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-notes-"));
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

  it("creates, fetches, and lists notes for a user", () => {
    const first = db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      content: "watch closely",
    });
    const second = db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-2",
      content: "repeat offender",
    });

    const fetched = db.GetNoteById(first.id, "guild-1");
    expect(fetched?.content).toBe("watch closely");
    expect(fetched?.moderator_id).toBe("mod-1");

    const notes = db.GetNotes("user-1", "guild-1");
    expect(notes).toHaveLength(2);
    expect(notes[0].id).toBe(first.id);
    expect(notes[1].id).toBe(second.id);
  });

  it("respects guild scoping when fetching notes by id", () => {
    const note = db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      content: "internal note",
    });

    expect(db.GetNoteById(note.id, "guild-1")).not.toBeNull();
    expect(db.GetNoteById(note.id, "guild-2")).toBeNull();
  });

  it("removes notes by id and returns the latest note", () => {
    db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      content: "first note",
    });
    const latest = db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-2",
      content: "latest note",
    });

    const removedLatest = db.RemoveLatestNote("user-1", "guild-1");
    expect(removedLatest?.id).toBe(latest.id);
    expect(removedLatest?.content).toBe("latest note");
    expect(db.GetNotes("user-1", "guild-1")).toHaveLength(1);

    const remaining = db.GetNotes("user-1", "guild-1")[0];
    expect(db.RemoveNoteById(remaining.id, "guild-1")).toBe(true);
    expect(db.RemoveNoteById(remaining.id, "guild-1")).toBe(false);
    expect(db.GetNotes("user-1", "guild-1")).toHaveLength(0);
  });

  it("applies limit when listing notes", () => {
    db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      content: "one",
    });
    db.AddNote({
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      content: "two",
    });

    expect(db.GetNotes("user-1", "guild-1", 1)).toHaveLength(1);
  });
});
