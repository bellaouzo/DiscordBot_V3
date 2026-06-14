import { describe, expect, it } from "vitest";
import { ButtonStyle } from "discord.js";
import { BuildNavigationRow } from "@systems/Setup/builders/navigation";

const ids = {
  back: "setup:back",
  next: "setup:next",
  saveAndQuit: "setup:save",
  cancel: "setup:cancel",
};

describe("Setup navigation builder", () => {
  it("builds welcome step navigation", () => {
    const row = BuildNavigationRow({ step: 1, ids });
    const labels = row.components.map((component) =>
      "label" in component ? component.label : "",
    );

    expect(labels).toContain("Get Started");
    expect(labels).not.toContain("Back");
    expect(labels).toContain("Cancel");
  });

  it("builds middle step navigation", () => {
    const row = BuildNavigationRow({ step: 3, ids });
    const labels = row.components.map((component) =>
      "label" in component ? component.label : "",
    );

    expect(labels).toContain("Back");
    expect(labels).toContain("Next");
    expect(labels).not.toContain("Save & Finish");
  });

  it("builds final step navigation", () => {
    const row = BuildNavigationRow({ step: 6, ids });
    const labels = row.components.map((component) =>
      "label" in component ? component.label : "",
    );
    const styles = row.components.map((component) =>
      "style" in component ? component.style : undefined,
    );

    expect(labels).toContain("Save & Finish");
    expect(labels).not.toContain("Next");
    expect(styles).toContain(ButtonStyle.Success);
  });
});
