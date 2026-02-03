import { describe, it, expect, vi, beforeEach } from "vitest";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { createMockDatabaseSet } from "../../helpers";

describe("EconomyManager", () => {
  const guildId = "guild-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("EnsureBalance returns balance from userDb", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 250,
      updated_at: Date.now(),
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    expect(manager.EnsureBalance("u1")).toBe(250);
    expect(databases.userDb.EnsureBalance).toHaveBeenCalledWith(
      "u1",
      guildId,
      100
    );
  });

  it("GetBalance returns balance when userDb returns one", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 300,
      updated_at: Date.now(),
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    expect(manager.GetBalance("u1")).toBe(300);
  });

  it("GetBalance ensures balance when userDb returns null", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue(null);
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 100,
      updated_at: Date.now(),
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    expect(manager.GetBalance("u1")).toBe(100);
  });

  it("AdjustBalance calls userDb.AdjustBalance and returns new balance", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 150,
      updated_at: Date.now(),
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    expect(manager.AdjustBalance("u1", 50, 0)).toBe(150);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith({
      user_id: "u1",
      guild_id: guildId,
      delta: 50,
      minBalance: 0,
      startingBalance: 100,
    });
  });

  it("ClaimDaily returns success when userDb returns success", () => {
    const databases = createMockDatabaseSet();
    const nextAt = Date.now() + 86400000;
    vi.mocked(databases.userDb.ClaimDaily).mockReturnValue({
      success: true,
      balance: {
        user_id: "u1",
        guild_id: guildId,
        balance: 200,
        updated_at: Date.now(),
      },
      nextAvailableAt: nextAt,
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    const result = manager.ClaimDaily("u1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.balance).toBe(200);
      expect(result.nextAvailableAt).toBe(nextAt);
    }
  });

  it("ClaimDaily returns cooldown when userDb returns success false", () => {
    const databases = createMockDatabaseSet();
    const nextAt = Date.now() + 3600000;
    vi.mocked(databases.userDb.ClaimDaily).mockReturnValue({
      success: false,
      nextAvailableAt: nextAt,
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    const result = manager.ClaimDaily("u1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.nextAvailableAt).toBe(nextAt);
    }
  });

  it("TransferBalance returns success when userDb transfer succeeds", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.TransferBalance).mockReturnValue({
      success: true,
      from: {
        user_id: "u1",
        guild_id: guildId,
        balance: 50,
        updated_at: Date.now(),
      },
      to: {
        user_id: "u2",
        guild_id: guildId,
        balance: 150,
        updated_at: Date.now(),
      },
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    const result = manager.TransferBalance({
      fromUserId: "u1",
      toUserId: "u2",
      amount: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.fromBalance).toBe(50);
      expect(result.toBalance).toBe(150);
    }
  });

  it("TransferBalance returns insufficient when userDb returns success false", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.TransferBalance).mockReturnValue({
      success: false,
      reason: "insufficient",
    });
    const manager = new EconomyManager(guildId, databases.userDb);
    const result = manager.TransferBalance({
      fromUserId: "u1",
      toUserId: "u2",
      amount: 500,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("insufficient");
    }
  });

  it("GetInventory returns userDb.GetInventory result", () => {
    const databases = createMockDatabaseSet();
    const inventory = [
      {
        userId: "u1",
        guildId,
        itemId: "reroll-token",
        quantity: 2,
        updatedAt: Date.now(),
      },
    ];
    vi.mocked(databases.userDb.GetInventory).mockReturnValue(inventory);
    const manager = new EconomyManager(guildId, databases.userDb);
    expect(manager.GetInventory("u1")).toEqual(inventory);
  });
});
