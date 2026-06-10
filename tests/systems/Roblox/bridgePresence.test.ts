import { afterEach, describe, expect, it, vi } from "vitest";
import * as Utilities from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import { FindPlayerPresence } from "@systems/Roblox/bridgePresence";

const settings: RobloxBridgeSettings = {
  url: "https://bridge.test",
  apiKey: "bridge-key",
  urlSigningSecret: "signing-secret",
  timeoutMs: 5000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bridgePresence", () => {
  it("returns first match when player is found", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          found: true,
          matches: [{ userId: 123, username: "PlayerOne", placeId: 1 }],
        },
      },
    } as never);

    const match = await FindPlayerPresence(settings, "PlayerOne");

    expect(match).toEqual({
      userId: 123,
      username: "PlayerOne",
      placeId: 1,
    });
  });

  it("returns null when no matches", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: { found: false, matches: [] },
      },
    } as never);

    const match = await FindPlayerPresence(settings, "MissingPlayer");

    expect(match).toBeNull();
  });

  it("throws when API request fails", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 500,
      error: "server error",
      data: { error: "Presence lookup failed" },
    } as never);

    await expect(FindPlayerPresence(settings, "PlayerOne")).rejects.toThrow(
      "Presence lookup failed",
    );
  });
});
