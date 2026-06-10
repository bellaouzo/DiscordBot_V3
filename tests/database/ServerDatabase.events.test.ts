import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase event operations", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-events-"));
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

  it("creates events with sequential guild_event_id per guild", () => {
    const first = db.CreateEvent({
      guild_id: "guild-1",
      title: "First Event",
      scheduled_at: Date.now() + 60_000,
      should_notify: true,
      created_by: "user-1",
    });
    const second = db.CreateEvent({
      guild_id: "guild-1",
      title: "Second Event",
      scheduled_at: Date.now() + 120_000,
      should_notify: false,
      created_by: "user-2",
    });

    expect(first.guild_event_id).toBe(1);
    expect(second.guild_event_id).toBe(2);
    expect(first.should_notify).toBe(true);
    expect(second.should_notify).toBe(false);
  });

  it("sequences guild_event_id independently per guild", () => {
    const guildOne = db.CreateEvent({
      guild_id: "guild-1",
      title: "Guild 1 Event",
      scheduled_at: Date.now() + 60_000,
      should_notify: false,
      created_by: "user-1",
    });
    const guildTwo = db.CreateEvent({
      guild_id: "guild-2",
      title: "Guild 2 Event",
      scheduled_at: Date.now() + 60_000,
      should_notify: false,
      created_by: "user-2",
    });

    expect(guildOne.guild_event_id).toBe(1);
    expect(guildTwo.guild_event_id).toBe(1);
  });

  it("lists upcoming events ordered by scheduled_at", () => {
    const now = Date.now();
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Later",
      scheduled_at: now + 120_000,
      should_notify: false,
      created_by: "user-1",
    });
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Sooner",
      scheduled_at: now + 60_000,
      should_notify: false,
      created_by: "user-1",
    });

    const upcoming = db.ListUpcomingEvents("guild-1", now);
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].title).toBe("Sooner");
    expect(upcoming[1].title).toBe("Later");
  });

  it("excludes past events from upcoming list", () => {
    const now = Date.now();
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Past",
      scheduled_at: now - 60_000,
      should_notify: false,
      created_by: "user-1",
    });
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Future",
      scheduled_at: now + 60_000,
      should_notify: false,
      created_by: "user-1",
    });

    const upcoming = db.ListUpcomingEvents("guild-1", now);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].title).toBe("Future");
  });

  it("gets event by guild_event_id and guild_id", () => {
    const created = db.CreateEvent({
      guild_id: "guild-1",
      title: "Lookup Event",
      scheduled_at: Date.now() + 60_000,
      should_notify: true,
      created_by: "user-1",
    });

    const fetched = db.GetEventById(created.guild_event_id, "guild-1");
    expect(fetched?.title).toBe("Lookup Event");
    expect(fetched?.guild_id).toBe("guild-1");

    const wrongGuild = db.GetEventById(created.guild_event_id, "guild-2");
    expect(wrongGuild).toBeNull();
  });

  it("deletes event by guild_event_id", () => {
    const created = db.CreateEvent({
      guild_id: "guild-1",
      title: "To Delete",
      scheduled_at: Date.now() + 60_000,
      should_notify: false,
      created_by: "user-1",
    });

    const deleted = db.DeleteEvent(created.guild_event_id, "guild-1");
    expect(deleted).toBe(true);

    const fetched = db.GetEventById(created.guild_event_id, "guild-1");
    expect(fetched).toBeNull();
  });

  it("reuses deleted guild_event_id gaps", () => {
    const first = db.CreateEvent({
      guild_id: "guild-1",
      title: "First",
      scheduled_at: Date.now() + 60_000,
      should_notify: false,
      created_by: "user-1",
    });
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Second",
      scheduled_at: Date.now() + 120_000,
      should_notify: false,
      created_by: "user-1",
    });

    db.DeleteEvent(first.guild_event_id, "guild-1");

    const third = db.CreateEvent({
      guild_id: "guild-1",
      title: "Third",
      scheduled_at: Date.now() + 180_000,
      should_notify: false,
      created_by: "user-1",
    });

    expect(third.guild_event_id).toBe(1);
  });

  it("lists events due for notification and marks them notified", () => {
    const now = Date.now();
    const due = db.CreateEvent({
      guild_id: "guild-1",
      title: "Due Event",
      scheduled_at: now - 1000,
      should_notify: true,
      created_by: "user-1",
    });
    db.CreateEvent({
      guild_id: "guild-1",
      title: "Future Notify",
      scheduled_at: now + 60_000,
      should_notify: true,
      created_by: "user-1",
    });
    db.CreateEvent({
      guild_id: "guild-1",
      title: "No Notify",
      scheduled_at: now - 2000,
      should_notify: false,
      created_by: "user-1",
    });

    const pending = db.ListEventsDueForNotification(now);
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe("Due Event");

    expect(db.MarkEventNotified(due.id, now)).toBe(true);
    expect(db.ListEventsDueForNotification(now)).toHaveLength(0);
    expect(db.GetEventById(due.guild_event_id, "guild-1")?.notified_at).toBe(
      now,
    );
  });
});
