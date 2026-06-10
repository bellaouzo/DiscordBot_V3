import { describe, it, expect } from "vitest";
import {
  GenerateCrashPoint,
  AdvanceCrashMultiplier,
  CalculateCrashPayout,
  ApplyCrashBoosterBonus,
  ShouldAutoCashOut,
  HasReachedCrashPoint,
} from "@systems/Economy/utils/crashLogic";

describe("crashLogic", () => {
  it("generates crash point within expected range", () => {
    expect(GenerateCrashPoint(0)).toBe(1.1);
    expect(GenerateCrashPoint(1)).toBe(5.5);
    expect(GenerateCrashPoint(0.5)).toBe(3.25);
  });

  it("advances multiplier without exceeding crash ceiling", () => {
    expect(AdvanceCrashMultiplier(1.0, 3.0)).toBeCloseTo(1.12);
    expect(AdvanceCrashMultiplier(3.2, 3.0)).toBe(3.5);
  });

  it("calculates crash payout from bet and multiplier", () => {
    expect(CalculateCrashPayout(100, 2.5)).toBe(250);
    expect(CalculateCrashPayout(0, 2.5)).toBe(0);
  });

  it("applies crash booster bonus", () => {
    expect(ApplyCrashBoosterBonus(200)).toEqual({ payout: 230, bonus: 30 });
  });

  it("detects auto cashout threshold", () => {
    expect(ShouldAutoCashOut(2.0, 50, true, false)).toBe(true);
    expect(ShouldAutoCashOut(1.9, 50, true, false)).toBe(false);
    expect(ShouldAutoCashOut(2.0, 50, true, true)).toBe(false);
    expect(ShouldAutoCashOut(2.0, 0, true, false)).toBe(false);
  });

  it("detects when crash point is reached", () => {
    expect(HasReachedCrashPoint(3.0, 2.8)).toBe(true);
    expect(HasReachedCrashPoint(2.0, 2.8)).toBe(false);
  });
});
