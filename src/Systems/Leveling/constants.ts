export const XP_DAILY_CLAIM = 25;
export const XP_GAME_PLAY = 5;
export const XP_GAME_WIN_SMALL = 10;
export const XP_GAME_WIN_MEDIUM = 20;
export const XP_GAME_WIN_LARGE = 30;
export const XP_TRIVIA_CORRECT = 15;

export const BET_THRESHOLD_MEDIUM = 100;
export const BET_THRESHOLD_LARGE = 500;

export const LEVEL_EXPONENT = 1.5;
export const BASE_XP_PER_LEVEL = 100;

export function CalculateXpForLevel(level: number): number {
  return Math.floor(BASE_XP_PER_LEVEL * Math.pow(level, LEVEL_EXPONENT));
}

export function CalculateWinXp(bet: number): number {
  if (bet >= BET_THRESHOLD_LARGE) {
    return XP_GAME_WIN_LARGE;
  }
  if (bet >= BET_THRESHOLD_MEDIUM) {
    return XP_GAME_WIN_MEDIUM;
  }
  if (bet > 0) {
    return XP_GAME_WIN_SMALL;
  }
  return XP_GAME_PLAY;
}
