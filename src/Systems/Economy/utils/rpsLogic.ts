import type { RpsChoice } from "@systems/Economy/types";

export type RpsOutcome = "win" | "loss" | "draw";

export function DetermineRpsOutcome(
  player: RpsChoice,
  opponent: RpsChoice,
): RpsOutcome {
  if (player === opponent) {
    return "draw";
  }

  const beats: Record<RpsChoice, RpsChoice> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  return beats[player] === opponent ? "win" : "loss";
}
