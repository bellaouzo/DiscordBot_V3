import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase giveaway operations", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-giveaways-"));
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

  it("creates and fetches giveaways by message id", () => {
    const giveaway = db.CreateGiveaway({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-1",
      host_id: "host-1",
      prize: "Nitro",
      winner_count: 2,
      ends_at: Date.now() + 60_000,
    });

    expect(giveaway.prize).toBe("Nitro");
    expect(giveaway.ended).toBe(false);
    expect(giveaway.winners).toBeNull();

    const fetched = db.GetGiveawayByMessageId("message-1");
    expect(fetched?.id).toBe(giveaway.id);
  });

  it("tracks giveaway entries and prevents duplicates", () => {
    const giveaway = db.CreateGiveaway({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-2",
      host_id: "host-1",
      prize: "Gift card",
      winner_count: 1,
      ends_at: Date.now() + 60_000,
    });

    expect(db.AddGiveawayEntry(giveaway.id, "user-1")).toBe(true);
    expect(db.AddGiveawayEntry(giveaway.id, "user-2")).toBe(true);
    expect(db.AddGiveawayEntry(giveaway.id, "user-1")).toBe(false);

    expect(db.HasEnteredGiveaway(giveaway.id, "user-1")).toBe(true);
    expect(db.GetGiveawayEntryCount(giveaway.id)).toBe(2);
    expect(db.GetGiveawayEntries(giveaway.id).sort()).toEqual([
      "user-1",
      "user-2",
    ]);

    expect(db.RemoveGiveawayEntry(giveaway.id, "user-1")).toBe(true);
    expect(db.HasEnteredGiveaway(giveaway.id, "user-1")).toBe(false);
    expect(db.GetGiveawayEntryCount(giveaway.id)).toBe(1);
  });

  it("lists active giveaways and ended giveaways ready to process", () => {
    const active = db.CreateGiveaway({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-active",
      host_id: "host-1",
      prize: "Active prize",
      winner_count: 1,
      ends_at: Date.now() + 120_000,
    });
    db.CreateGiveaway({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-expired",
      host_id: "host-1",
      prize: "Expired prize",
      winner_count: 1,
      ends_at: Date.now() - 5_000,
    });

    const activeGiveaways = db.GetActiveGiveaways("guild-1");
    expect(activeGiveaways.map((entry) => entry.message_id)).toContain(
      active.message_id,
    );
    expect(activeGiveaways.every((entry) => !entry.ended)).toBe(true);

    const toProcess = db.GetEndedGiveawaysToProcess();
    expect(toProcess.map((entry) => entry.message_id)).toContain(
      "message-expired",
    );
    expect(toProcess.map((entry) => entry.message_id)).not.toContain(
      active.message_id,
    );
  });

  it("ends a giveaway and stores winners", () => {
    const giveaway = db.CreateGiveaway({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-end",
      host_id: "host-1",
      prize: "Steam key",
      winner_count: 1,
      ends_at: Date.now() + 60_000,
    });

    db.AddGiveawayEntry(giveaway.id, "user-1");
    db.AddGiveawayEntry(giveaway.id, "user-2");

    expect(db.EndGiveaway("message-end", ["user-2"])).toBe(true);

    const ended = db.GetGiveawayByMessageId("message-end");
    expect(ended?.ended).toBe(true);
    expect(ended?.winners).toEqual(["user-2"]);
    expect(db.GetActiveGiveaways("guild-1")).toHaveLength(0);
    expect(db.EndGiveaway("missing-message", ["user-1"])).toBe(false);
  });
});
