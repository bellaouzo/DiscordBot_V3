import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketManager } from "@systems/Economy/MarketManager";
import { createMockDatabaseSet } from "../../helpers";
import { ITEM_MAP } from "@systems/Economy/items";

describe("MarketManager", () => {
  const guildId = "guild-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GetOffers returns offers from rotation", () => {
    const databases = createMockDatabaseSet();
    const itemIds = Object.keys(ITEM_MAP).slice(0, 3);
    const expiresAt = Date.now() + 3600000;
    vi.mocked(databases.userDb.GetMarketRotation).mockReturnValue({
      guildId,
      items: itemIds,
      generatedAt: Date.now(),
      expiresAt,
    });
    const manager = new MarketManager(guildId, databases.userDb);
    const offers = manager.GetOffers();
    expect(offers.length).toBe(itemIds.length);
    offers.forEach((offer, i) => {
      expect(offer.item).toBe(ITEM_MAP[itemIds[i]]);
      expect(offer.rotationExpiresAt).toBe(expiresAt);
    });
  });

  it("BuyItem throws when item not in rotation", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetMarketRotation).mockReturnValue({
      guildId,
      items: ["reroll-token"],
      generatedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 500,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const manager = new MarketManager(guildId, databases.userDb);
    expect(() =>
      manager.BuyItem({ userId: "u1", itemId: "lucky-coin", quantity: 1 })
    ).toThrow("Item not available in current rotation");
  });

  it("BuyItem throws when balance insufficient", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetMarketRotation).mockReturnValue({
      guildId,
      items: ["reroll-token"],
      generatedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 10,
      updated_at: Date.now(),
    });
    const manager = new MarketManager(guildId, databases.userDb);
    expect(() =>
      manager.BuyItem({ userId: "u1", itemId: "reroll-token", quantity: 1 })
    ).toThrow("Insufficient balance");
  });

  it("BuyItem returns balance and inventory when successful", () => {
    const databases = createMockDatabaseSet();
    const itemId = "reroll-token";
    vi.mocked(databases.userDb.GetMarketRotation).mockReturnValue({
      guildId,
      items: [itemId],
      generatedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 500,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 380,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustInventoryQuantity).mockReturnValue({
      userId: "u1",
      guildId,
      itemId,
      quantity: 1,
      updatedAt: Date.now(),
    });
    const manager = new MarketManager(guildId, databases.userDb);
    const result = manager.BuyItem({
      userId: "u1",
      itemId,
      quantity: 1,
    });
    expect(result.balance).toBe(380);
    expect(result.inventory.itemId).toBe(itemId);
    expect(result.inventory.quantity).toBe(1);
  });

  it("SellItem throws when not enough quantity", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([
      {
        userId: "u1",
        guildId,
        itemId: "reroll-token",
        quantity: 1,
        updatedAt: Date.now(),
      },
    ]);
    const manager = new MarketManager(guildId, databases.userDb);
    expect(() =>
      manager.SellItem({ userId: "u1", itemId: "reroll-token", quantity: 5 })
    ).toThrow("Not enough quantity to sell");
  });

  it("SellItem returns balance and inventory when successful", () => {
    const databases = createMockDatabaseSet();
    const itemId = "reroll-token";
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([
      {
        userId: "u1",
        guildId,
        itemId,
        quantity: 3,
        updatedAt: Date.now(),
      },
    ]);
    vi.mocked(databases.userDb.AdjustInventoryQuantity).mockReturnValue({
      userId: "u1",
      guildId,
      itemId,
      quantity: 1,
      updatedAt: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 160,
      updated_at: Date.now(),
    });
    const manager = new MarketManager(guildId, databases.userDb);
    const result = manager.SellItem({
      userId: "u1",
      itemId,
      quantity: 2,
    });
    expect(result.balance).toBe(160);
    expect(result.inventory.quantity).toBe(1);
  });
});
