import { describe, it, expect } from "vitest";
import {
  ITEM_CATALOG,
  ITEM_MAP,
  DEFAULT_ROTATION_IDS,
} from "@systems/Economy/items";

describe("Economy items", () => {
  it("ITEM_CATALOG is a non-empty array", () => {
    expect(Array.isArray(ITEM_CATALOG)).toBe(true);
    expect(ITEM_CATALOG.length).toBeGreaterThan(0);
  });

  it("each catalog entry has required fields", () => {
    for (const item of ITEM_CATALOG) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("sellPrice");
      expect(item).toHaveProperty("rarity");
      expect(item).toHaveProperty("type");
      expect(typeof item.id).toBe("string");
      expect(typeof item.price).toBe("number");
      expect(typeof item.sellPrice).toBe("number");
      expect(["common", "rare", "epic"]).toContain(item.rarity);
      expect(["consumable", "booster"]).toContain(item.type);
    }
  });

  it("ITEM_MAP has an entry for each catalog item by id", () => {
    expect(typeof ITEM_MAP).toBe("object");
    for (const item of ITEM_CATALOG) {
      expect(ITEM_MAP[item.id]).toBeDefined();
      expect(ITEM_MAP[item.id]).toEqual(item);
    }
  });

  it("DEFAULT_ROTATION_IDS contains all catalog ids", () => {
    expect(Array.isArray(DEFAULT_ROTATION_IDS)).toBe(true);
    expect(DEFAULT_ROTATION_IDS.length).toBe(ITEM_CATALOG.length);
    for (const item of ITEM_CATALOG) {
      expect(DEFAULT_ROTATION_IDS).toContain(item.id);
    }
  });

  it("key items exist in ITEM_MAP", () => {
    expect(ITEM_MAP["reroll-token"]).toBeDefined();
    expect(ITEM_MAP["lucky-coin"]).toBeDefined();
    expect(ITEM_MAP["flip-charm"]).toBeDefined();
    expect(ITEM_MAP["coin-guardian"]).toBeDefined();
  });
});
