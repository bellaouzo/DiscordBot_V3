import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Utilities from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  PollKickResult,
  PostKickCommand,
  RequestApiKeyStatus,
  RequestGroupAudit,
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
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useRealTimers();
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

  it("RequestGroupAudit throws with error code on failure", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 400,
      data: {
        ok: false,
        error: { code: "INVALID_PLAYER", message: "Player not found" },
      },
    } as never);

    await expect(
      RequestGroupAudit(settings, "guild-1", { player: "MissingPlayer" }),
    ).rejects.toMatchObject({
      message: "Player not found",
      code: "INVALID_PLAYER",
    });
  });

  it("PollKickResult returns failure when result request fails", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 500,
      error: "Bridge unavailable",
    } as never);

    const result = await PollKickResult(settings, "cmd-fail");

    expect(result).toEqual({
      kind: "failure",
      code: "RESULT_REQUEST_FAILED",
      message: "Bridge unavailable",
      commandId: "cmd-fail",
    });
  });

  it("RequestGroupAudit returns audit payload on success", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: { player: "PlayerOne", entries: [{ role: "Member" }] },
      },
    } as never);

    const result = await RequestGroupAudit(settings, "guild-1", {
      player: "PlayerOne",
    });

    expect(result.data?.entries).toHaveLength(1);
  });

  it("PollKickResult returns failure when bridge reports command failure", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          result: {
            ok: false,
            code: "KICK_FAILED",
            message: "Unable to kick player",
          },
        },
      },
    } as never);

    const result = await PollKickResult(settings, "cmd-failed");

    expect(result).toEqual({
      kind: "failure",
      code: "KICK_FAILED",
      message: "Unable to kick player",
      commandId: "cmd-failed",
    });
  });

  it("PollKickResult returns success when command completes", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          result: {
            ok: true,
            code: "ACKNOWLEDGED",
            message: "Kick completed",
          },
        },
      },
    } as never);

    const result = await PollKickResult(settings, "cmd-success");

    expect(result).toEqual({
      kind: "success",
      code: "ACKNOWLEDGED",
      message: "Kick completed",
      commandId: "cmd-success",
    });
  });

  it("PollKickResult times out when no result is returned", async () => {
    vi.useFakeTimers();
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not Found",
    } as never);

    const resultPromise = PollKickResult(settings, "cmd-timeout");
    await vi.advanceTimersByTimeAsync(25_000);
    const result = await resultPromise;

    expect(result).toEqual({
      kind: "timeout",
      code: "RESULT_TIMEOUT",
      message: "Timed out waiting for Roblox command result.",
      commandId: "cmd-timeout",
    });
  });
});
