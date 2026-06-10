import type { FlipChoice } from "@systems/Economy/types";

export function FlipCoin(): FlipChoice {
  return Math.random() < 0.5 ? "heads" : "tails";
}

export function OppositeFlipChoice(choice: FlipChoice): FlipChoice {
  return choice === "heads" ? "tails" : "heads";
}
