import { describe, expect, it } from "vitest";
import {
  FlipCoin,
  OppositeFlipChoice,
} from "@systems/Economy/utils/flipLogic";

describe("flipLogic", () => {
  it("returns opposite choices", () => {
    expect(OppositeFlipChoice("heads")).toBe("tails");
    expect(OppositeFlipChoice("tails")).toBe("heads");
  });

  it("flips to heads or tails", () => {
    const results = new Set(
      Array.from({ length: 20 }, () => FlipCoin()),
    );
    expect(results.has("heads") || results.has("tails")).toBe(true);
  });
});
