import { describe, it, expect } from "vitest";
import {
  handValue,
  isBlackjack,
  drawCard,
  BJ_DECK,
} from "@systems/Economy/utils/blackjackLogic";

describe("blackjackLogic", () => {
  it("calculates hand value with soft ace", () => {
    expect(handValue(["A", "9"])).toBe(20);
    expect(handValue(["A", "9", "5"])).toBe(15);
  });

  it("detects natural blackjack", () => {
    expect(isBlackjack(["A", "K"])).toBe(true);
    expect(isBlackjack(["A", "9", "2"])).toBe(false);
  });

  it("draws cards from deck", () => {
    const deck = [...BJ_DECK];
    const card = drawCard(deck);
    expect(BJ_DECK).toContain(card);
    expect(deck).toHaveLength(BJ_DECK.length - 1);
  });
});
