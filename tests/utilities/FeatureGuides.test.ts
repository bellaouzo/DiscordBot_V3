import { describe, expect, it } from "vitest";
import {
  BuildFeatureGuideEmbed,
  GetFeatureGuide,
  AppendFeatureGuideHint,
} from "@utilities/FeatureGuides";
import { EmbedFactory } from "@utilities";

describe("FeatureGuides", () => {
  it("returns starboard guide content", () => {
    const guide = GetFeatureGuide("starboard");

    expect(guide?.name).toBe("Starboard");
    expect(guide?.command).toBe("/starboard");
  });

  it("includes newer server systems like economy and tickets", () => {
    expect(GetFeatureGuide("economy")?.name).toBe("Economy");
    expect(GetFeatureGuide("ticket")?.name).toBe("Support Tickets");
    expect(GetFeatureGuide("setup")?.name).toBe("Server Setup");
  });

  it("builds a feature guide embed", () => {
    const guide = GetFeatureGuide("reactionrole");
    expect(guide).not.toBeNull();

    const embed = BuildFeatureGuideEmbed(guide!);

    expect(embed.data.title).toContain("Reaction Roles");
    expect(
      embed.data.fields?.some((field) => field.name === "How it works"),
    ).toBe(true);
  });

  it("appends a what-is-this hint to status embeds", () => {
    const embed = EmbedFactory.Create({
      title: "Starboard Status",
      description: "Configured",
    });

    AppendFeatureGuideHint(embed, "starboard");

    expect(
      embed.data.fields?.some((field) => field.name === "What is this?"),
    ).toBe(true);
  });
});
