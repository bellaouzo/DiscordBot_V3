import { describe, it, expect } from "vitest";
import { ButtonStyle } from "discord.js";
import {
  ComponentFactory,
  ToActionRowData,
  ToActionRowDataArray,
} from "@utilities/ComponentBuilder";

interface ButtonJson {
  label?: string;
  custom_id?: string;
  style?: number;
  emoji?: unknown;
  disabled?: boolean;
}

describe("ComponentFactory", () => {
  describe("CreateButton", () => {
    it("creates button with label and customId", () => {
      const btn = ComponentFactory.CreateButton({
        label: "Click",
        customId: "btn:1",
      });
      const data = btn.toJSON() as ButtonJson;
      expect(data.label).toBe("Click");
      expect(data.custom_id).toBe("btn:1");
      expect(data.style).toBe(ButtonStyle.Secondary);
    });

    it("applies style and emoji when provided", () => {
      const btn = ComponentFactory.CreateButton({
        label: "Go",
        customId: "go",
        style: ButtonStyle.Primary,
        emoji: "✅",
      });
      const data = btn.toJSON() as ButtonJson;
      expect(data.style).toBe(ButtonStyle.Primary);
      expect(data.emoji).toBeDefined();
    });

    it("can set disabled", () => {
      const btn = ComponentFactory.CreateButton({
        label: "Off",
        customId: "off",
        disabled: true,
      });
      expect((btn.toJSON() as ButtonJson).disabled).toBe(true);
    });
  });

  describe("CreateActionRow", () => {
    it("creates row with multiple buttons", () => {
      const row = ComponentFactory.CreateActionRow({
        buttons: [{ label: "A" }, { label: "B" }],
        customIds: ["a", "b"],
      });
      const data = row.toJSON();
      expect(data.components).toHaveLength(2);
      expect((data.components?.[0] as ButtonJson).label).toBe("A");
      expect((data.components?.[1] as ButtonJson).label).toBe("B");
    });
  });

  describe("CreateHelpSectionButtons", () => {
    it("creates overview and section buttons", () => {
      const rows = ComponentFactory.CreateHelpSectionButtons(
        [{ name: "Fun" }, { name: "Utility" }],
        "abc",
        -1
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const first = rows[0].toJSON();
      expect(first.components?.length).toBeLessThanOrEqual(5);
    });
  });

  describe("CreatePaginationButtons", () => {
    it("creates five buttons for pagination", () => {
      const row = ComponentFactory.CreatePaginationButtons(0, 5, "pid");
      const data = row.toJSON();
      expect(data.components).toHaveLength(5);
    });

    it("disables first/prev on first page", () => {
      const row = ComponentFactory.CreatePaginationButtons(0, 3, "pid");
      const data = row.toJSON();
      const first = data.components?.[0];
      const prev = data.components?.[1];
      expect(first?.disabled).toBe(true);
      expect(prev?.disabled).toBe(true);
    });

    it("disables next on last page", () => {
      const row = ComponentFactory.CreatePaginationButtons(2, 3, "pid");
      const data = row.toJSON();
      const next = data.components?.[3];
      expect(next?.disabled).toBe(true);
    });
  });

  describe("CreateSelectMenuOption", () => {
    it("creates option with label and value", () => {
      const opt = ComponentFactory.CreateSelectMenuOption({
        label: "Option A",
        value: "a",
      });
      const data = opt.toJSON();
      expect(data.label).toBe("Option A");
      expect(data.value).toBe("a");
    });
  });

  describe("CreateSelectMenu", () => {
    it("creates select with options", () => {
      const menu = ComponentFactory.CreateSelectMenu({
        customId: "select:1",
        options: [
          { label: "One", value: "1" },
          { label: "Two", value: "2" },
        ],
      });
      const data = menu.toJSON();
      expect(data.custom_id).toBe("select:1");
      expect(data.options).toHaveLength(2);
    });
  });

  describe("CreateUserSelectMenu", () => {
    it("creates user select with customId", () => {
      const menu = ComponentFactory.CreateUserSelectMenu({
        customId: "user:1",
      });
      const data = menu.toJSON();
      expect(data.custom_id).toBe("user:1");
    });
  });

  describe("ToActionRowData", () => {
    it("converts row to JSON-like data", () => {
      const row = ComponentFactory.CreateActionRow({
        buttons: [{ label: "X" }],
        customIds: ["x"],
      });
      const data = ToActionRowData(row);
      expect(data).toHaveProperty("components");
      expect(Array.isArray(data.components)).toBe(true);
    });
  });

  describe("ToActionRowDataArray", () => {
    it("converts array of rows", () => {
      const rows = [
        ComponentFactory.CreateActionRow({
          buttons: [{ label: "A" }],
          customIds: ["a"],
        }),
      ];
      const arr = ToActionRowDataArray(rows);
      expect(arr).toHaveLength(1);
      expect(arr[0]).toHaveProperty("components");
    });
  });
});
