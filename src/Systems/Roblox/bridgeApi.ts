import { RequestJson } from "@utilities";
import type {
  RobloxBridgeSettings,
  RobloxBridgeCommandResponse,
  RobloxCommandResultResponse,
  RobloxCommandResultPayload,
  RobloxApiKeyStatusResponse,
  RobloxApiKeyDeleteResponse,
  RobloxGroupAuditResponse,
  RobloxGroupInfoResponse,
  DiscordModeratorInfo,
  KickExecutionOutcome,
} from "@systems/Roblox/types";
import {
  RESULT_POLL_INTERVAL_MS,
  RESULT_POLL_TIMEOUT_MS,
} from "@systems/Roblox/types";
import { ExtractErrorMessage } from "@systems/Roblox/bridgeEmbeds";

function BuildBridgeCommandUrl(baseUrl: string): string {
  return new URL("/api/v1/commands/post", baseUrl).toString();
}

function BuildApiKeyStatusUrl(baseUrl: string, guildId: string): string {
  const url = new URL("/api/v1/roblox/apikey", baseUrl);
  url.searchParams.set("guild_id", guildId);
  return url.toString();
}

function BuildApiKeyDeleteUrl(baseUrl: string, guildId: string): string {
  const url = new URL("/api/v1/roblox/apikey", baseUrl);
  url.searchParams.set("guild_id", guildId);
  return url.toString();
}

function BuildCommandResultUrl(baseUrl: string, commandId: string): string {
  const url = new URL("/api/v1/commands/result", baseUrl);
  url.searchParams.set("id", commandId);
  return url.toString();
}

function BuildGroupAuditUrl(
  baseUrl: string,
  guildId: string,
  options: { player?: string; userId?: string },
): string {
  const url = new URL("/api/v1/roblox/group/audit", baseUrl);
  url.searchParams.set("guild_id", guildId);
  if (options.player !== undefined && options.player !== "") {
    url.searchParams.set("player", options.player);
  } else if (options.userId !== undefined && options.userId !== "") {
    url.searchParams.set("user_id", options.userId);
  }
  return url.toString();
}

function BuildGroupInfoUrl(baseUrl: string, guildId: string): string {
  const url = new URL("/api/v1/roblox/group/info", baseUrl);
  url.searchParams.set("guild_id", guildId);
  return url.toString();
}

function Delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function PostKickCommand(
  settings: RobloxBridgeSettings,
  playerName: string,
  reason: string,
  serverId: string,
  moderator: DiscordModeratorInfo,
): Promise<string> {
  const response = await RequestJson<RobloxBridgeCommandResponse>(
    BuildBridgeCommandUrl(settings.url),
    {
      method: "POST",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      body: {
        type: "kick",
        payload: {
          playerName,
          reason,
          discordUser: moderator,
        },
        target: {
          scope: "server",
          serverId,
        },
        source: "discord-bot",
      },
      timeoutMs: settings.timeoutMs,
    },
  );

  if (!response.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to post kick command",
    );
  }

  const body = response.data as RobloxBridgeCommandResponse & { id?: string };
  const id = body?.data?.id ?? body?.id;
  if (!id) {
    throw new Error(
      ExtractErrorMessage(body?.error) ??
        response.error ??
        "Failed to post kick command",
    );
  }
  return id;
}

export async function RequestApiKeyStatus(
  settings: RobloxBridgeSettings,
  guildId: string,
): Promise<RobloxApiKeyStatusResponse["data"]> {
  const response = await RequestJson<RobloxApiKeyStatusResponse>(
    BuildApiKeyStatusUrl(settings.url, guildId),
    {
      method: "GET",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    },
  );

  if (response.status === 404) {
    return { configured: false };
  }

  if (!response.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to fetch Roblox API key status",
    );
  }

  const body = response.data as
    | RobloxApiKeyStatusResponse
    | RobloxApiKeyStatusResponse["data"];
  const data = body && "data" in body && body.data ? body.data : body;
  if (data && typeof data === "object" && "configured" in data) {
    return data as RobloxApiKeyStatusResponse["data"];
  }

  return { configured: false };
}

export async function RequestApiKeyDelete(
  settings: RobloxBridgeSettings,
  guildId: string,
): Promise<void> {
  const response = await RequestJson<RobloxApiKeyDeleteResponse>(
    BuildApiKeyDeleteUrl(settings.url, guildId),
    {
      method: "DELETE",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    },
  );

  if (!response.ok || !response.data?.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to delete Roblox API key",
    );
  }
}

export async function RequestGroupAudit(
  settings: RobloxBridgeSettings,
  guildId: string,
  options: { player?: string; userId?: string },
): Promise<RobloxGroupAuditResponse> {
  const url = BuildGroupAuditUrl(settings.url, guildId, options);
  const response = await RequestJson<RobloxGroupAuditResponse>(url, {
    method: "GET",
    headers: {
      "x-api-key": settings.apiKey,
      "User-Agent": "DiscordBotV3/RobloxCommand",
    },
    timeoutMs: settings.timeoutMs,
  });

  const err = response.data?.error;
  const code = typeof err === "object" && err?.code ? err.code : undefined;
  const message =
    (typeof err === "object" && err?.message) ||
    (typeof err === "string" ? err : undefined) ||
    response.error ||
    "Group audit request failed";

  if (!response.ok || response.data?.ok === false) {
    const e = new Error(message) as Error & { code?: string };
    e.code = code;
    throw e;
  }

  return response.data ?? {};
}

export async function RequestGroupInfo(
  settings: RobloxBridgeSettings,
  guildId: string,
): Promise<RobloxGroupInfoResponse> {
  const url = BuildGroupInfoUrl(settings.url, guildId);
  const response = await RequestJson<RobloxGroupInfoResponse>(url, {
    method: "GET",
    headers: {
      "x-api-key": settings.apiKey,
      "User-Agent": "DiscordBotV3/RobloxCommand",
    },
    timeoutMs: settings.timeoutMs,
  });

  const err = response.data?.error;
  const code = typeof err === "object" && err?.code ? err.code : undefined;
  const message =
    (typeof err === "object" && err?.message) ||
    (typeof err === "string" ? err : undefined) ||
    response.error ||
    "Group info request failed";

  if (!response.ok || response.data?.ok === false) {
    const e = new Error(message) as Error & { code?: string };
    e.code = code;
    throw e;
  }

  return response.data ?? {};
}

export async function PollKickResult(
  settings: RobloxBridgeSettings,
  commandId: string,
): Promise<KickExecutionOutcome> {
  const start = Date.now();

  while (Date.now() - start < RESULT_POLL_TIMEOUT_MS) {
    const response = await RequestJson<RobloxCommandResultResponse>(
      BuildCommandResultUrl(settings.url, commandId),
      {
        method: "GET",
        headers: {
          "x-api-key": settings.apiKey,
          "User-Agent": "DiscordBotV3/RobloxCommand",
        },
        timeoutMs: settings.timeoutMs,
      },
    );

    if (response.status === 404) {
      await Delay(RESULT_POLL_INTERVAL_MS);
      continue;
    }

    if (!response.ok) {
      return {
        kind: "failure",
        code: "RESULT_REQUEST_FAILED",
        message:
          ExtractErrorMessage(response.data?.error) ??
          response.error ??
          "Failed to fetch command result",
        commandId,
      };
    }

    const payload = response.data as RobloxCommandResultResponse & {
      result?: RobloxCommandResultPayload;
    };
    const result = payload?.data?.result ?? payload?.result;
    if (!result) {
      await Delay(RESULT_POLL_INTERVAL_MS);
      continue;
    }

    return result.ok
      ? {
          kind: "success",
          code: result.code,
          message: result.message,
          commandId,
        }
      : {
          kind: "failure",
          code: result.code,
          message: result.message,
          commandId,
        };
  }

  return {
    kind: "timeout",
    code: "RESULT_TIMEOUT",
    message: "Timed out waiting for Roblox command result.",
    commandId,
  };
}
