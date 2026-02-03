import { describe, it, expect } from "vitest";
import {
  XP_DAILY_CLAIM,
  XP_GAME_PLAY,
  XP_GAME_WIN_SMALL,
  XP_GAME_WIN_MEDIUM,
  XP_GAME_WIN_LARGE,
  XP_TRIVIA_CORRECT,
  BET_THRESHOLD_MEDIUM,
  BET_THRESHOLD_LARGE,
  LEVEL_EXPONENT,
  BASE_XP_PER_LEVEL,
  CalculateXpForLevel,
  CalculateWinXp,
} from "@systems/Leveling/constants";

describe("Leveling constants", () => {
  it("exports expected XP constants", () => {
    expect(XP_DAILY_CLAIM).toBe(25);
    expect(XP_GAME_PLAY).toBe(5);
    expect(XP_GAME_WIN_SMALL).toBe(10);
    expect(XP_GAME_WIN_MEDIUM).toBe(20);
    expect(XP_GAME_WIN_LARGE).toBe(30);
    expect(XP_TRIVIA_CORRECT).toBe(15);
  });

  it("exports bet thresholds and level constants", () => {
    expect(BET_THRESHOLD_MEDIUM).toBe(100);
    expect(BET_THRESHOLD_LARGE).toBe(500);
    expect(LEVEL_EXPONENT).toBe(1.5);
    expect(BASE_XP_PER_LEVEL).toBe(100);
  });

  it("CalculateXpForLevel returns increasing XP per level", () => {
    expect(CalculateXpForLevel(1)).toBe(100);
    expect(CalculateXpForLevel(2)).toBeGreaterThan(100);
    expect(CalculateXpForLevel(3)).toBeGreaterThan(CalculateXpForLevel(2));
  });

  it("CalculateWinXp returns XP by bet tier", () => {
    expect(CalculateWinXp(0)).toBe(XP_GAME_PLAY);
    expect(CalculateWinXp(50)).toBe(XP_GAME_WIN_SMALL);
    expect(CalculateWinXp(100)).toBe(XP_GAME_WIN_MEDIUM);
    expect(CalculateWinXp(500)).toBe(XP_GAME_WIN_LARGE);
    expect(CalculateWinXp(1000)).toBe(XP_GAME_WIN_LARGE);
  });
});
