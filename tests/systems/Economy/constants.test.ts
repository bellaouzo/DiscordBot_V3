import { describe, it, expect } from "vitest";
import {
  STARTING_BALANCE,
  MIN_BET,
  MAX_BET,
  FLIP_TIMEOUT_MS,
  RPS_TIMEOUT_MS,
  CRASH_TIMEOUT_MS,
  CRASH_TICK_MS,
  HORSE_TIMEOUT_MS,
  HORSE_TICK_MS,
  HORSE_TRACK_LENGTH,
  HORSE_PAYOUT_MULTIPLIER,
  SCRATCH_TIMEOUT_MS,
  BJ_TIMEOUT_MS,
  BJ_DEALER_STAND,
  BJ_BLACKJACK_PAYOUT,
  DAILY_REWARD,
  DAILY_COOLDOWN_MS,
  DICE_PAYOUT_MULTIPLIER,
  MARKET_ROTATION_MS,
  MARKET_ROTATION_SIZE,
  SLOTS_TIMEOUT_MS,
  WHEEL_TIMEOUT_MS,
} from "@systems/Economy/constants";

describe("Economy constants", () => {
  it("exports expected numeric constants", () => {
    expect(STARTING_BALANCE).toBe(100);
    expect(MIN_BET).toBe(1);
    expect(MAX_BET).toBe(1000);
    expect(DAILY_REWARD).toBe(100);
    expect(DICE_PAYOUT_MULTIPLIER).toBe(6);
    expect(HORSE_TRACK_LENGTH).toBe(8);
    expect(HORSE_PAYOUT_MULTIPLIER).toBe(3);
    expect(BJ_DEALER_STAND).toBe(17);
    expect(BJ_BLACKJACK_PAYOUT).toBe(2.5);
    expect(MARKET_ROTATION_SIZE).toBe(6);
  });

  it("exports timeout constants in milliseconds", () => {
    expect(FLIP_TIMEOUT_MS).toBe(45_000);
    expect(RPS_TIMEOUT_MS).toBe(45_000);
    expect(CRASH_TIMEOUT_MS).toBe(45_000);
    expect(CRASH_TICK_MS).toBe(1_000);
    expect(HORSE_TIMEOUT_MS).toBe(45_000);
    expect(HORSE_TICK_MS).toBe(1_000);
    expect(SCRATCH_TIMEOUT_MS).toBe(45_000);
    expect(BJ_TIMEOUT_MS).toBe(45_000);
    expect(SLOTS_TIMEOUT_MS).toBe(30_000);
    expect(WHEEL_TIMEOUT_MS).toBe(30_000);
  });

  it("exports daily cooldown as 24 hours in ms", () => {
    expect(DAILY_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("exports market rotation as 6 hours in ms", () => {
    expect(MARKET_ROTATION_MS).toBe(6 * 60 * 60 * 1000);
  });
});
