import { describe, expect, it } from "vitest";
import {
  EmbedFactory,
  RequireGuild,
  RequireDefined,
  ComponentFactory,
} from "@utilities";

describe("Utilities index exports", () => {
  it("exposes core utility modules", () => {
    expect(EmbedFactory).toBeDefined();
    expect(RequireGuild).toBeTypeOf("function");
    expect(RequireDefined).toBeTypeOf("function");
    expect(ComponentFactory).toBeDefined();
  });
});
