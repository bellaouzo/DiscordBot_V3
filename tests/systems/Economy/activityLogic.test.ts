import { describe, expect, it } from "vitest";
import {
  GenerateWorkTask,
  ScrambleWord,
} from "@systems/Economy/utils/workLogic";
import {
  FISH_TABLE,
  RollBiteDelay,
  RollCatch,
  RollFish,
} from "@systems/Economy/utils/fishLogic";

function SeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("work tasks", () => {
  it("always offers four distinct, non-negative options including the answer", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const task = GenerateWorkTask(SeededRandom(seed));
      expect(task.options).toHaveLength(4);
      expect(new Set(task.options).size).toBe(4);
      expect(task.options[task.correctIndex]).toBeDefined();
      task.options
        .filter((option) => /^-?\d+$/.test(option))
        .forEach((option) => expect(Number(option)).toBeGreaterThanOrEqual(0));
    }
  });

  it("scrambles words into a different arrangement of the same letters", () => {
    expect(ScrambleWord(() => 0, "maple")).not.toBe("maple");
    const random = SeededRandom(9);
    for (let i = 0; i < 50; i++) {
      const scrambled = ScrambleWord(random, "harbor");
      expect(scrambled).not.toBe("harbor");
      expect([...scrambled].sort().join("")).toBe(
        [..."harbor"].sort().join(""),
      );
    }
  });
});

describe("fishing", () => {
  it("rolls fish across the whole table", () => {
    expect(RollFish(() => 0)).toBe(FISH_TABLE[0]);
    expect(RollFish(() => 0.999999)).toBe(FISH_TABLE[FISH_TABLE.length - 1]);
  });

  it("keeps coins within range and applies the perfect bonus", () => {
    const normal = RollCatch({
      random: () => 0.5,
      perfect: false,
      perfectBonus: 1.5,
    });
    expect(normal.coins).toBeGreaterThanOrEqual(normal.fish.minCoins);
    expect(normal.coins).toBeLessThanOrEqual(normal.fish.maxCoins);
    const perfect = RollCatch({
      random: () => 0.5,
      perfect: true,
      perfectBonus: 1.5,
    });
    expect(perfect.coins).toBe(Math.floor(normal.coins * 1.5));
  });

  it("keeps bite delays in range", () => {
    expect(RollBiteDelay(() => 0, 2000, 6000)).toBe(2000);
    expect(RollBiteDelay(() => 0.999999, 2000, 6000)).toBe(6000);
  });
});
