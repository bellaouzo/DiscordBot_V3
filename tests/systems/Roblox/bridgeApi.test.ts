import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as Utilities from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  PostKickCommand,
  RequestApiKeyStatus,
  RequestGroupInfo,
} from "@systems/Roblox/bridgeApi";

const settings: RobloxBridgeSettings = {
  url: "https://bridge.test",
  apiKey: "bridge-key",
  urlSigningSecret: "signing-secret",
  timeoutMs: 5000,
};

beforeAll(() => {
  process.env.ROBLOX_BRIDGE_API_URL = settings.url;
  process.env.ROBLOX_BRIDGE_API_KEY = settings.apiKey;
  process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET = settings.urlSigningSecret;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bridgeApi", () => {
  it("PostKickCommand returns command id on success", async () => {
    const requestSpy = vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: { id: "cmd-123" },
      },
    } as never);

    const id = await PostKickCommand(
      settings,
      "PlayerOne",
      "Rule violation",
      "server-1",
      { id: "mod-1", username: "Mod", tag: "Mod#0001" },
    );

    expect(id).toBe("cmd-123");
    expect(requestSpy).toHaveBeenCalledWith(
      "https://bridge.test/api/v1/commands/post",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "bridge-key" }),
        body: expect.objectContaining({
          type: "kick",
          payload: expect.objectContaining({ playerName: "PlayerOne" }),
        }),
      }),
    );
  });

  it("RequestApiKeyStatus returns configured false on 404", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not Found",
    } as never);

    const status = await RequestApiKeyStatus(settings, "guild-1");
    expect(status).toEqual({ configured: false });
  });

  it("RequestGroupInfo throws with error code on failure", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 403,
      data: {
        ok: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      },
    } as never);

    await expect(RequestGroupInfo(settings, "guild-1")).rejects.toMatchObject({
      message: "Access denied",
      code: "FORBIDDEN",
    });
  });
});
