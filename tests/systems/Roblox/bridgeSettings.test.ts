import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("bridgeSettings", () => {
  const previous = {
    ROBLOX_BRIDGE_API_URL: process.env.ROBLOX_BRIDGE_API_URL,
    ROBLOX_BRIDGE_API_KEY: process.env.ROBLOX_BRIDGE_API_KEY,
    ROBLOX_BRIDGE_URL_SIGNING_SECRET:
      process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.ROBLOX_BRIDGE_API_URL = "https://bridge.test";
    process.env.ROBLOX_BRIDGE_API_KEY = "bridge-key";
    process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET = "signing-secret";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  async function loadModule() {
    return import("@systems/Roblox/bridgeSettings");
  }

  it("returns bridge settings when env vars are configured", async () => {
    const { EnsureRobloxBridgeSettings } = await loadModule();
    const settings = EnsureRobloxBridgeSettings();

    expect(settings).toEqual({
      url: "https://bridge.test",
      apiKey: "bridge-key",
      urlSigningSecret: "signing-secret",
      timeoutMs: expect.any(Number),
    });
  });

  it("throws when bridge URL is missing", async () => {
    delete process.env.ROBLOX_BRIDGE_API_URL;
    const { EnsureRobloxBridgeSettings } = await loadModule();

    expect(() => EnsureRobloxBridgeSettings()).toThrow(
      "ROBLOX_BRIDGE_API_URL",
    );
  });

  it("throws when API key is missing", async () => {
    delete process.env.ROBLOX_BRIDGE_API_KEY;
    const { EnsureRobloxBridgeSettings } = await loadModule();

    expect(() => EnsureRobloxBridgeSettings()).toThrow(
      "ROBLOX_BRIDGE_API_KEY",
    );
  });

  it("throws when signing secret is missing", async () => {
    delete process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET;
    const { EnsureRobloxBridgeSettings } = await loadModule();

    expect(() => EnsureRobloxBridgeSettings()).toThrow(
      "ROBLOX_BRIDGE_URL_SIGNING_SECRET",
    );
  });

  it("builds signed setup URLs", async () => {
    const { BuildApiKeySetupUrl } = await loadModule();
    const url = BuildApiKeySetupUrl(
      "https://bridge.test",
      "guild-1",
      "user-1",
      "signing-secret",
    );

    expect(url).toContain("guild_id=guild-1");
    expect(url).toContain("user_id=user-1");
    expect(url).toContain("sig=");
    expect(url).toContain("expires=");
  });
});
