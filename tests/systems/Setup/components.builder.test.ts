import { describe, expect, it } from "vitest";
import { PromoteResourceItem } from "@systems/Setup/resources";
import {
  BuildChannelSelectRow,
  BuildSingleRoleSelectRow,
} from "@systems/Setup/builders/components";

describe("PromoteResourceItem", () => {
  it("adds a new item to the front of the list", () => {
    const items = [{ id: "existing", name: "Existing" }];
    const created = { id: "created", name: "Created" };

    PromoteResourceItem(items, created);

    expect(items[0]).toEqual(created);
    expect(items).toHaveLength(2);
  });

  it("moves an existing item to the front", () => {
    const first = { id: "a", name: "A" };
    const second = { id: "b", name: "B" };
    const items = [first, second];

    PromoteResourceItem(items, second);

    expect(items[0]).toEqual(second);
    expect(items[1]).toEqual(first);
    expect(items).toHaveLength(2);
  });
});

describe("Setup select builders", () => {
  it("includes None for unverified-style single role selects", () => {
    const row = BuildSingleRoleSelectRow({
      customId: "setup:unverified",
      placeholder: "Unverified role — given on join (required)",
      fieldLabel: "Unverified role",
      roles: [{ id: "role-1", name: "Unverified" } as never],
      selectedId: "role-1",
      allowNone: true,
    });
    const menu = row.components[0];
    const options =
      "options" in menu && Array.isArray(menu.options) ? menu.options : [];
    const values = options.map((option) =>
      "value" in option ? option.value : "",
    );
    const labels = options.map((option) =>
      "label" in option ? option.label : "",
    );

    expect(values).toContain("none");
    expect(values).toContain("role-1");
    expect(labels).toContain("Unverified role: Unverified");
  });

  it("prefixes selected channel options with the field label", () => {
    const row = BuildChannelSelectRow({
      customId: "setup:deletelog",
      channels: [{ id: "chan-1", name: "mod-logs" } as never],
      selectedId: "chan-1",
      placeholder: "Delete logs channel — message deletion audit log",
      fieldLabel: "Delete logs",
      defaultName: "delete-logs",
      allowNone: true,
    });
    const menu = row.components[0];
    const options =
      "options" in menu && Array.isArray(menu.options) ? menu.options : [];
    const labels = options.map((option) =>
      "label" in option ? option.label : "",
    );

    expect(labels).toContain("Delete logs: #mod-logs");
    expect(labels).toContain("None");
  });
});
