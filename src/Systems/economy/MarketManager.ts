import { UserDatabase } from "@database";
import { EconomyManager } from "./EconomyManager";
import { MARKET_ROTATION_MS, MARKET_ROTATION_SIZE } from "./constants";
import { ITEM_MAP, DEFAULT_ROTATION_IDS } from "./items";
import type { InventoryEntry, MarketOffer } from "./types";

function pickRotation(size: number): string[] {
  const source = [...DEFAULT_ROTATION_IDS];
  for (let i = source.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return source.slice(0, Math.max(1, Math.min(size, source.length)));
}

export class MarketManager {
  private readonly economy: EconomyManager;

  constructor(
    private readonly guildId: string,
    userDb: UserDatabase
  ) {
    this.economy = new EconomyManager(guildId, userDb);
  }

  GetOffers(): MarketOffer[] {
    const rotation = this.ensureRotation();
    return rotation.items
      .map((id) => {
        const item = ITEM_MAP[id];
        if (!item) {
          return null;
        }
        return { item, rotationExpiresAt: rotation.expiresAt };
      })
      .filter((offer): offer is MarketOffer => offer !== null);
  }

  RefreshOffers(): MarketOffer[] {
    const rotation = this.ensureRotation(true);
    return rotation.items
      .map((id) => {
        const item = ITEM_MAP[id];
        if (!item) {
          return null;
        }
        return { item, rotationExpiresAt: rotation.expiresAt };
      })
      .filter((offer): offer is MarketOffer => offer !== null);
  }

  BuyItem(options: { userId: string; itemId: string; quantity: number }): {
    balance: number;
    inventory: InventoryEntry;
  } {
    const item = ITEM_MAP[options.itemId];
    if (!item) {
      throw new Error("Unknown item");
    }

    const rotation = this.ensureRotation();
    if (!rotation.items.includes(options.itemId)) {
      throw new Error("Item not available in current rotation");
    }

    const qty = Math.max(1, options.quantity);
    const cost = item.price * qty;

    const balanceBefore = this.economy.GetBalance(options.userId);
    if (balanceBefore < cost) {
      throw new Error("Insufficient balance");
    }

    const currentInventory = this.economy
      .GetInventory(options.userId)
      .find((entry) => entry.itemId === options.itemId);
    const nextQuantity = (currentInventory?.quantity ?? 0) + qty;
    if (item.maxStack && nextQuantity > item.maxStack) {
      throw new Error("Exceeds max stack for this item");
    }

    const balance = this.economy.AdjustBalance(options.userId, -cost, 0);
    const inventory = this.economy.AdjustInventoryItem({
      userId: options.userId,
      itemId: options.itemId,
      delta: qty,
    });

    return { balance, inventory };
  }

  SellItem(options: { userId: string; itemId: string; quantity: number }): {
    balance: number;
    inventory: InventoryEntry;
  } {
    const item = ITEM_MAP[options.itemId];
    if (!item) {
      throw new Error("Unknown item");
    }

    const qty = Math.max(1, options.quantity);
    const inventoryEntry = this.economy
      .GetInventory(options.userId)
      .find((entry) => entry.itemId === options.itemId);

    if (!inventoryEntry || inventoryEntry.quantity < qty) {
      throw new Error("Not enough quantity to sell");
    }

    const payout = item.sellPrice * qty;
    const inventory = this.economy.AdjustInventoryItem({
      userId: options.userId,
      itemId: options.itemId,
      delta: -qty,
    });
    const balance = this.economy.AdjustBalance(options.userId, payout, 0);

    return { balance, inventory };
  }

  private ensureRotation(force = false) {
    const now = Date.now();
    const existing = this.economy.GetMarketRotation();
    if (!force && existing && existing.expiresAt > now) {
      return existing;
    }

    const items = pickRotation(MARKET_ROTATION_SIZE).filter(
      (id) => ITEM_MAP[id]
    );
    const generatedAt = now;
    const expiresAt = now + MARKET_ROTATION_MS;

    const rotation = { guildId: this.guildId, items, generatedAt, expiresAt };
    this.economy.SetMarketRotation(rotation);
    return rotation;
  }
}

