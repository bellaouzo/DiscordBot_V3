import { describe, expect, it } from "vitest";
import { ResolveLevelsToReward } from "@systems/Leveling/LevelRewardManager";

describe("LevelRewardManager", () => {
  it("resolves all levels in a multi-level jump", () => {
    expect(ResolveLevelsToReward(2, 5)).toEqual([3, 4, 5]);
  });

  it("returns empty array when level does not increase", () => {
    expect(ResolveLevelsToReward(5, 5)).toEqual([]);
  });

  it("returns single level for one-level jump", () => {
    expect(ResolveLevelsToReward(1, 2)).toEqual([2]);
  });
});
