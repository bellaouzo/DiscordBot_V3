import { describe, expect, it, vi } from "vitest";
import {
  FEATURES,
  IsFeatureEnabled,
  TOGGLEABLE_FEATURES,
} from "@shared/Features";
import { GUILD_SETTING_FIELDS } from "@database/Server/GuildSettingsSchema";

function CreateServerDb(options: {
  settings?: Record<string, unknown> | null;
  xpEnabled?: boolean;
}) {
  return {
    GetGuildSettings: vi.fn(() => options.settings ?? null),
    GetGuildXpSettings: vi.fn(() => ({ enabled: options.xpEnabled ?? false })),
  } as never;
}

describe("Features registry", () => {
  it("has unique feature keys", () => {
    const keys = FEATURES.map((feature) => feature.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every toggle exactly one way to read its state", () => {
    for (const feature of TOGGLEABLE_FEATURES) {
      const { setting, readEnabled } = feature.toggle;
      expect(
        Boolean(setting) !== Boolean(readEnabled),
        `${feature.key} must define exactly one of setting / readEnabled`,
      ).toBe(true);
    }
  });

  it("only references boolean guild settings", () => {
    for (const feature of TOGGLEABLE_FEATURES) {
      const setting = feature.toggle.setting;
      if (setting) {
        expect(typeof GUILD_SETTING_FIELDS[setting].defaultValue).toBe(
          "boolean",
        );
      }
    }
  });

  it("orders toggles by their order field", () => {
    const orders = TOGGLEABLE_FEATURES.map((feature) => feature.toggle.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("uses schema defaults when a guild has no saved settings", () => {
    const serverDb = CreateServerDb({ settings: null });

    expect(IsFeatureEnabled(serverDb, "g1", "economy")).toBe(true);
    expect(IsFeatureEnabled(serverDb, "g1", "verification")).toBe(false);
  });

  it("reads derived toggles without touching unrelated settings", () => {
    const serverDb = CreateServerDb({ settings: null, xpEnabled: true });

    expect(IsFeatureEnabled(serverDb, "g1", "leveling")).toBe(true);
    expect(IsFeatureEnabled(serverDb, "g1", "starboard")).toBe(false);
  });
});
