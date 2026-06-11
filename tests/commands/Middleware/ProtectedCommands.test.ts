import { describe, expect, it } from "vitest";
import { IsProtectedCommand } from "@middleware/ProtectedCommands";

describe("ProtectedCommands", () => {
  it("protects core commands from disable", () => {
    expect(IsProtectedCommand("command")).toBe(true);
    expect(IsProtectedCommand("help")).toBe(true);
    expect(IsProtectedCommand("hub")).toBe(true);
    expect(IsProtectedCommand("health")).toBe(true);
  });

  it("does not protect regular commands", () => {
    expect(IsProtectedCommand("meme")).toBe(false);
    expect(IsProtectedCommand("economy")).toBe(false);
  });
});
