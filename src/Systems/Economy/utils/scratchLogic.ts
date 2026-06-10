import type { ScratchSymbol } from "@systems/Economy/types";

export const SCRATCH_COLUMNS = 3;
export const SCRATCH_ROWS = 3;
export const SCRATCH_SLOTS = SCRATCH_COLUMNS * SCRATCH_ROWS;
export const SCRATCH_SYMBOLS: ScratchSymbol[] = ["💰", "⭐", "🍀", "🍒"];

const EMPTY_SYMBOL_COUNTS: Record<ScratchSymbol, number> = {
  "💰": 0,
  "⭐": 0,
  "🍀": 0,
  "🍒": 0,
};

export const SCRATCH_HIDDEN_ICONS = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
];

export function CountScratchSymbols(
  reveals: ReadonlyArray<ScratchSymbol | null>,
): Record<ScratchSymbol, number> {
  return reveals.reduce<Record<ScratchSymbol, number>>(
    (acc, sym) => {
      if (sym) {
        acc[sym] = (acc[sym] ?? 0) + 1;
      }
      return acc;
    },
    { ...EMPTY_SYMBOL_COUNTS },
  );
}

export function ComputeScratchPayout(
  reveals: ReadonlyArray<ScratchSymbol | null>,
  bet: number,
): number {
  const maxCount = Math.max(...Object.values(CountScratchSymbols(reveals)));
  if (bet === 0) return 0;
  if (maxCount === 3) return bet * 5;
  if (maxCount === 2) return bet * 2;
  return 0;
}

export function WinStillPossible(
  reveals: ReadonlyArray<ScratchSymbol | null>,
): boolean {
  const counts = CountScratchSymbols(reveals);
  const remaining = reveals.filter((r) => r === null).length;
  const maxCount = Math.max(...Object.values(counts));
  return maxCount + remaining >= 2;
}

export function PickRandomScratchSymbol(
  random: number,
  symbols: readonly ScratchSymbol[] = SCRATCH_SYMBOLS,
): ScratchSymbol {
  const index = Math.floor(random * symbols.length);
  return symbols[Math.min(index, symbols.length - 1)];
}

export function FillRemainingScratchReveals(
  reveals: Array<ScratchSymbol | null>,
  randomValues: number[],
): void {
  let randomIndex = 0;
  for (let i = 0; i < reveals.length; i++) {
    if (reveals[i] === null) {
      const random = randomValues[randomIndex] ?? Math.random();
      randomIndex += 1;
      reveals[i] = PickRandomScratchSymbol(random);
    }
  }
}

export function ApplyScratchCloverPayout(bet: number): number {
  return bet * 2;
}

export function ApplyScratchBonusPayout(payout: number): {
  payout: number;
  bonus: number;
} {
  const bonus = Math.floor(payout * 0.5);
  return { payout: payout + bonus, bonus };
}

export function ApplyScratchBonusLossRefund(bet: number): number {
  return Math.floor(bet * 0.5);
}
