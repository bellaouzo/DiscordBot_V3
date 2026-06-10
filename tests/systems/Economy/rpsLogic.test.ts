import { describe, expect, it } from "vitest";
import { DetermineRpsOutcome } from "@systems/Economy/utils/rpsLogic";

describe("rpsLogic", () => {
  it("detects draws", () => {
    expect(DetermineRpsOutcome("rock", "rock")).toBe("draw");
  });

  it("detects wins and losses", () => {
    expect(DetermineRpsOutcome("rock", "scissors")).toBe("win");
    expect(DetermineRpsOutcome("rock", "paper")).toBe("loss");
  });
});
