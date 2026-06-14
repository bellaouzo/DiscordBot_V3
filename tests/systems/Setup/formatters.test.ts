import { describe, expect, it } from "vitest";
import {
  FormatCategory,
  FormatChannel,
  FormatChannelAllowNone,
  FormatFeatureModulesOverview,
  FormatModuleStatus,
  FormatRoleList,
  FormatSingleRole,
} from "@systems/Setup/builders/formatters";

function CreateGuild(overrides?: {
  roles?: Map<string, { toString: () => string }>;
  channels?: Map<string, { toString?: () => string; name?: string }>;
}) {
  return {
    roles: {
      cache: overrides?.roles ?? new Map(),
    },
    channels: {
      cache: overrides?.channels ?? new Map(),
    },
  } as never;
}

describe("Setup formatters", () => {
  it("formats role lists and single roles", () => {
    expect(FormatRoleList([], CreateGuild(), true)).toBe(
      "No roles selected (required)",
    );
    expect(FormatRoleList([], CreateGuild())).toBe("None selected");
    expect(FormatRoleList(["missing"], CreateGuild())).toBe(
      "Roles not found (they may have been deleted)",
    );

    const guild = CreateGuild({
      roles: new Map([["role-1", { toString: () => "<@&role-1>" }]]),
    });
    expect(FormatRoleList(["role-1"], guild)).toBe("<@&role-1>");
    expect(FormatSingleRole(null, guild)).toBe("None selected");
    expect(FormatSingleRole("missing", guild)).toBe("Role ID: missing");
    expect(FormatSingleRole("role-1", guild)).toBe("<@&role-1>");
  });

  it("formats channels and categories", () => {
    const guild = CreateGuild({
      channels: new Map([
        ["cat-1", { name: "Support", toString: () => "<#cat-1>" }],
        ["chan-1", { toString: () => "<#chan-1>" }],
      ]),
    });

    expect(FormatCategory(null, guild, "Tickets")).toBe(
      "Auto-manage **Tickets**",
    );
    expect(FormatCategory("missing", guild, "Tickets")).toBe(
      "Category ID: missing",
    );
    expect(FormatCategory("cat-1", guild, "Tickets")).toBe(
      "Support (cat-1)",
    );

    expect(FormatChannel(null, guild, "Logs")).toBe("Auto-manage **Logs**");
    expect(FormatChannel("missing", guild, "Logs")).toBe("Channel ID: missing");
    expect(FormatChannel("chan-1", guild, "Logs")).toBe("<#chan-1>");
    expect(FormatChannelAllowNone(null, guild, "Logs")).toBe("Disabled");
    expect(FormatChannelAllowNone("chan-1", guild, "Logs")).toBe("<#chan-1>");
  });

  it("formats module status and overview text", () => {
    expect(FormatModuleStatus(true)).toBe("🟢 On");
    expect(FormatModuleStatus(false)).toBe("🔴 Off");

    const overview = FormatFeatureModulesOverview([
      {
        emoji: "💰",
        label: "Economy",
        description: "Coins and games",
        enabled: true,
      },
      {
        emoji: "🎁",
        label: "Giveaways",
        description: "Hosted giveaways",
        enabled: false,
      },
    ]);

    expect(overview).toContain("Economy");
    expect(overview).toContain("Giveaways");
    expect(overview).toContain("🔴 Off");
  });
});
