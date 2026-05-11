import { afterEach, describe, expect, it } from "vitest";
import {
  ListStrictStartupFeatureViolations,
  LoadApiConfig,
  StrictFeatureKeysEnabled,
} from "@config/ApiConfig";

describe("StrictFeatureKeysEnabled", () => {
  const previous = process.env.BOT_STRICT_FEATURE_KEYS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.BOT_STRICT_FEATURE_KEYS;
    } else {
      process.env.BOT_STRICT_FEATURE_KEYS = previous;
    }
  });

  it("is true when BOT_STRICT_FEATURE_KEYS is 1", () => {
    process.env.BOT_STRICT_FEATURE_KEYS = "1";
    expect(StrictFeatureKeysEnabled()).toBe(true);
  });

  it("is false when unset", () => {
    delete process.env.BOT_STRICT_FEATURE_KEYS;
    expect(StrictFeatureKeysEnabled()).toBe(false);
  });
});

describe("ListStrictStartupFeatureViolations", () => {
  it("requires signing secret when Roblox bridge URL is configured", () => {
    const base = LoadApiConfig();
    const violations = ListStrictStartupFeatureViolations({
      ...base,
      robloxBridge: {
        ...base.robloxBridge,
        url: "https://bridge.example",
        apiKey: "test-key",
        urlSigningSecret: "   ",
      },
    });

    expect(
      violations.some((entry) =>
        entry.message.includes("ROBLOX_BRIDGE_URL_SIGNING_SECRET")
      )
    ).toBe(true);
  });
});
