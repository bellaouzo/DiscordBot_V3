export const CRASH_MULTIPLIER_STEP = 1.12;
export const CRASH_MIN_POINT = 1.1;
export const CRASH_POINT_RANGE = 4.5;
export const CRASH_BOOSTER_BONUS_RATE = 0.15;
export const CRASH_AUTO_CASH_MULTIPLIER = 2.0;

export function GenerateCrashPoint(random: number): number {
  return Math.max(CRASH_MIN_POINT, 1 + random * CRASH_POINT_RANGE);
}

export function AdvanceCrashMultiplier(
  current: number,
  crashPoint: number,
): number {
  return Math.min(current * CRASH_MULTIPLIER_STEP, crashPoint + 0.5);
}

export function CalculateCrashPayout(bet: number, multiplier: number): number {
  return bet > 0 ? Math.floor(bet * multiplier) : 0;
}

export function ApplyCrashBoosterBonus(payout: number): {
  payout: number;
  bonus: number;
} {
  const bonus = Math.floor(payout * CRASH_BOOSTER_BONUS_RATE);
  return { payout: payout + bonus, bonus };
}

export function ShouldAutoCashOut(
  displayMultiplier: number,
  bet: number,
  hasAutoCash: boolean,
  autoCashUsed: boolean,
): boolean {
  return (
    hasAutoCash &&
    !autoCashUsed &&
    displayMultiplier >= CRASH_AUTO_CASH_MULTIPLIER &&
    bet > 0
  );
}

export function HasReachedCrashPoint(
  displayMultiplier: number,
  crashPoint: number,
): boolean {
  return displayMultiplier >= crashPoint;
}
