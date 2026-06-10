import { describe, it, expect } from "vitest";
import {
  ComputeScratchPayout,
  WinStillPossible,
  CountScratchSymbols,
  PickRandomScratchSymbol,
  FillRemainingScratchReveals,
  ApplyScratchBonusPayout,
  ApplyScratchCloverPayout,
  ApplyScratchBonusLossRefund,
  SCRATCH_SYMBOLS,
} from "@systems/Economy/utils/scratchLogic";
import { ScratchSymbol } from "@systems/Economy/types";

describe("scratchLogic", () => {
  it("counts scratch symbols", () => {
    const reveals: Array<ScratchSymbol | null> = [
      "💰",
      "💰",
      "⭐",
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    expect(CountScratchSymbols(reveals)).toEqual({
      "💰": 2,
      "⭐": 1,
      "🍀": 0,
      "🍒": 0,
    });
  });

  it("computes triple match payout", () => {
    const reveals: Array<ScratchSymbol | null> = [
      "🍀",
      "🍀",
      "🍀",
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    expect(ComputeScratchPayout(reveals, 10)).toBe(50);
  });

  it("computes pair payout", () => {
    const reveals: Array<ScratchSymbol | null> = [
      "⭐",
      "⭐",
      "🍒",
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    expect(ComputeScratchPayout(reveals, 10)).toBe(20);
  });

  it("returns zero payout when no pair exists", () => {
    const reveals: Array<ScratchSymbol | null> = [
      "💰",
      "⭐",
      "🍀",
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    expect(ComputeScratchPayout(reveals, 10)).toBe(0);
  });

  it("detects when a win is still possible", () => {
    expect(WinStillPossible(["💰", "💰", null, null, null, null, null, null, null])).toBe(
      true,
    );
    expect(WinStillPossible(["💰", "⭐", "🍀", "🍒"])).toBe(false);
  });

  it("picks random scratch symbols from provided values", () => {
    expect(PickRandomScratchSymbol(0, SCRATCH_SYMBOLS)).toBe("💰");
    expect(PickRandomScratchSymbol(0.99, SCRATCH_SYMBOLS)).toBe("🍒");
  });

  it("fills remaining scratch reveals", () => {
    const reveals: Array<ScratchSymbol | null> = Array(9).fill(null);
    reveals[0] = "💰";
    FillRemainingScratchReveals(reveals, [0, 0.25, 0.5, 0.75]);
    expect(reveals.every((symbol) => symbol !== null)).toBe(true);
  });

  it("applies scratch item payout modifiers", () => {
    expect(ApplyScratchCloverPayout(10)).toBe(20);
    expect(ApplyScratchBonusPayout(100)).toEqual({ payout: 150, bonus: 50 });
    expect(ApplyScratchBonusLossRefund(100)).toBe(50);
  });
});
