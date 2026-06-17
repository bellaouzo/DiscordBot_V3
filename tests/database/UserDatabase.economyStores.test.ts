import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { UserDatabase } from "@database";
import { createMockLogger } from "../helpers";

describe("UserDatabase economy stores", () => {
  let db: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "user-db-economy-stores-"));
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

  it("adjusts inventory quantities with max stack and deletion at zero", () => {
    expect(db.GetInventory("user-1", "guild-1")).toEqual([]);

    const added = db.AdjustInventoryQuantity({
      user_id: "user-1",
      guild_id: "guild-1",
      item_id: "potion",
      delta: 5,
      maxStack: 10,
    });
    expect(added.quantity).toBe(5);
    expect(db.GetInventoryItem("user-1", "guild-1", "potion")?.quantity).toBe(
      5,
    );

    const capped = db.AdjustInventoryQuantity({
      user_id: "user-1",
      guild_id: "guild-1",
      item_id: "potion",
      delta: 10,
      maxStack: 10,
    });
    expect(capped.quantity).toBe(10);

    const removed = db.AdjustInventoryQuantity({
      user_id: "user-1",
      guild_id: "guild-1",
      item_id: "potion",
      delta: -10,
    });
    expect(removed.quantity).toBe(0);
    expect(db.GetInventoryItem("user-1", "guild-1", "potion")).toBeNull();
  });

  it("manages lottery lifecycle and entries", () => {
    const lottery = db.CreateLottery({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-1",
      host_id: "host-1",
      entry_cost: 25,
      ends_at: Date.now() + 60_000,
    });

    expect(lottery.pot).toBe(0);
    expect(db.GetLotteryById(lottery.id)?.message_id).toBe("message-1");
    expect(db.GetLotteryByMessageId("message-1")?.id).toBe(lottery.id);
    expect(db.GetActiveLotteries("guild-1")).toHaveLength(1);

    expect(db.AddLotteryEntry(lottery.id, "user-1", 25)).toBe(true);
    expect(db.HasLotteryEntry(lottery.id, "user-1")).toBe(true);
    expect(db.GetLotteryEntries(lottery.id)).toEqual(["user-1"]);
    expect(db.AddLotteryEntry(lottery.id, "user-1", 25)).toBe(false);

    expect(db.EndLottery(lottery.id, "user-1")).toBe(true);
    expect(db.GetLotteryById(lottery.id)?.ended).toBe(true);
    expect(db.GetActiveLotteries("guild-1")).toHaveLength(0);
  });

  it("processes ended lotteries and duel status transitions", () => {
    const expired = db.CreateLottery({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-expired",
      host_id: "host-1",
      entry_cost: 10,
      ends_at: Date.now() - 1_000,
    });
    expect(
      db.GetEndedLotteriesToProcess().some((l) => l.id === expired.id),
    ).toBe(true);

    const duel = db.CreateDuel({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "duel-message",
      challenger_id: "user-1",
      opponent_id: "user-2",
      bet: 50,
      game: "rps",
      expires_at: Date.now() + 60_000,
    });

    expect(duel.status).toBe("pending");
    expect(db.GetDuelByMessageId("duel-message")?.id).toBe(duel.id);
    expect(db.ListPendingDuelsByChallenger("guild-1", "user-1")).toHaveLength(
      1,
    );

    expect(db.ActivateDuel(duel.id)).toBe(true);
    expect(db.GetDuelById(duel.id)?.status).toBe("active");
    expect(db.CompleteDuel(duel.id, "user-1")).toBe(true);
    expect(db.GetDuelById(duel.id)?.winner_id).toBe("user-1");

    const cancelled = db.CreateDuel({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "duel-cancel",
      challenger_id: "user-3",
      opponent_id: "user-4",
      bet: 25,
      game: "flip",
      expires_at: Date.now() + 60_000,
    });
    expect(db.CancelDuel(cancelled.id)).toBe(true);
    expect(db.GetDuelById(cancelled.id)?.status).toBe("cancelled");
  });
});
