import type { RandomSource } from "./workLogic";

export interface FishType {
  readonly name: string;
  readonly emoji: string;
  readonly minCoins: number;
  readonly maxCoins: number;
  readonly weight: number;
}

export const FISH_TABLE: readonly FishType[] = [
  { name: "Old Boot", emoji: "🥾", minCoins: 5, maxCoins: 5, weight: 15 },
  { name: "Minnow", emoji: "🐟", minCoins: 15, maxCoins: 25, weight: 42 },
  {
    name: "Tropical Fish",
    emoji: "🐠",
    minCoins: 35,
    maxCoins: 50,
    weight: 26,
  },
  { name: "Pufferfish", emoji: "🐡", minCoins: 60, maxCoins: 90, weight: 13 },
  { name: "Shark", emoji: "🦈", minCoins: 150, maxCoins: 200, weight: 4 },
];

export interface FishCatch {
  readonly fish: FishType;
  readonly coins: number;
  readonly perfect: boolean;
}

export function RollFish(random: RandomSource = Math.random): FishType {
  const totalWeight = FISH_TABLE.reduce((sum, fish) => sum + fish.weight, 0);
  let roll = random() * totalWeight;
  for (const fish of FISH_TABLE) {
    roll -= fish.weight;
    if (roll < 0) {
      return fish;
    }
  }
  return FISH_TABLE[FISH_TABLE.length - 1];
}

export function RollCatch(options: {
  random?: RandomSource;
  perfect: boolean;
  perfectBonus: number;
}): FishCatch {
  const random = options.random ?? Math.random;
  const fish = RollFish(random);
  const base =
    fish.minCoins + Math.floor(random() * (fish.maxCoins - fish.minCoins + 1));
  const coins = options.perfect
    ? Math.floor(base * options.perfectBonus)
    : base;
  return { fish, coins, perfect: options.perfect };
}

export function RollBiteDelay(
  random: RandomSource,
  minMs: number,
  maxMs: number,
): number {
  return minMs + Math.floor(random() * (maxMs - minMs + 1));
}
