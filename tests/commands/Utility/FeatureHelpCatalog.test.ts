import { describe, expect, it } from "vitest";
import {
  BuildFeatureCategoryView,
  FormatFeatureGuideFieldValue,
} from "@commands/Utility/Help/FeatureHelpCatalog";
import { FEATURE_GUIDES } from "@utilities";

describe("FeatureHelpCatalog", () => {
  it("builds a feature category view with pages", () => {
    const view = BuildFeatureCategoryView();

    expect(view.key).toBe("features");
    expect(view.commands.length).toBe(FEATURE_GUIDES.length);
    expect(view.pages.length).toBeGreaterThan(0);
  });

  it("formats setup and non-setup feature guides differently", () => {
    const setupGuide = FEATURE_GUIDES.find((guide) => guide.key === "setup");
    const otherGuide = FEATURE_GUIDES.find((guide) => guide.key !== "setup");

    expect(setupGuide).toBeDefined();
    expect(otherGuide).toBeDefined();

    expect(FormatFeatureGuideFieldValue(setupGuide!)).toContain("`/setup`");
    expect(FormatFeatureGuideFieldValue(otherGuide!)).toContain(" about`");
  });
});
