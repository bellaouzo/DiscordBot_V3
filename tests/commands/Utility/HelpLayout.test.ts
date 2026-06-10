import { describe, expect, it, vi } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import { CreateOverviewPayload } from "@commands/Utility/Help/HelpComponents";
import {
  BuildFeatureCategoryView,
  FormatFeatureGuideFieldValue,
} from "@commands/Utility/Help/FeatureHelpCatalog";
import { BuildCategoryViews } from "@commands/Utility/Help/HelpCatalog";

vi.mock("@commands/registry", () => ({
  AllCommands: vi.fn(() => [
    {
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Ping the bot"),
      group: "utility",
      execute: vi.fn(),
    },
  ]),
}));

describe("Help layout", () => {
  it("renders overview categories as a vertical list instead of inline fields", () => {
    const categories = [
      BuildFeatureCategoryView(),
      ...BuildCategoryViews([
        { name: "ping", description: "Ping the bot", group: "utility" },
      ]),
    ];

    const overview = CreateOverviewPayload(categories, "interaction-1");
    const embed = overview.embeds[0];

    expect(embed.fields ?? []).toHaveLength(0);
    expect(embed.description).toContain("📖 **Server Features**");
    expect(embed.description).toContain("🔧 **Utility**");
    expect(overview.components.length).toBeGreaterThanOrEqual(1);
    expect(overview.components[0].components.length).toBeLessThanOrEqual(3);
  });

  it("formats feature entries with spaced sections", () => {
    const value = FormatFeatureGuideFieldValue({
      key: "starboard",
      name: "Starboard",
      icon: "⭐",
      summary: "Highlights popular messages.",
      howItWorks: "ignored in field formatter",
      setup: "`/starboard set-channel`",
      command: "/starboard",
    });

    expect(value).toContain("Highlights popular messages.");
    expect(value).toContain("**Setup**");
    expect(value).toContain("**Learn more**");
    expect(value).toContain("`/starboard about`");
  });

  it("shows two features per page for readability", () => {
    const category = BuildFeatureCategoryView();

    expect(category.pages[0].fields?.length).toBe(2);
    expect(category.pages.length).toBeGreaterThan(1);
    expect(category.pages[1].description).toBeUndefined();
  });

  it("keeps setup and learn more sections adjacent", () => {
    const value = FormatFeatureGuideFieldValue({
      key: "giveaway",
      name: "Giveaways",
      icon: "🎁",
      summary: "Run timed giveaways.",
      howItWorks: "ignored",
      setup: "`/giveaway create`",
      command: "/giveaway",
    });

    expect(value).not.toContain("`/giveaway create`\n\n**Learn more**");
    expect(value).toContain("`/giveaway create`\n**Learn more**");
  });
});
