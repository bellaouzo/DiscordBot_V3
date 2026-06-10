import { RequestJson } from "@utilities";
import type {
  RobloxBridgeSettings,
  RobloxPresenceMatch,
  RobloxPresenceResponse,
} from "@systems/Roblox/types";
import { ExtractErrorMessage } from "@systems/Roblox/bridgeEmbeds";

function BuildPresenceFindUrl(baseUrl: string, playerName: string): string {
  const url = new URL("/api/v1/presence/find", baseUrl);
  url.searchParams.set("playerName", playerName);
  return url.toString();
}

export async function FindPlayerPresence(
  settings: RobloxBridgeSettings,
  playerName: string,
): Promise<RobloxPresenceMatch | null> {
  const response = await RequestJson<RobloxPresenceResponse>(
    BuildPresenceFindUrl(settings.url, playerName),
    {
      method: "GET",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    },
  );

  if (!response.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Presence lookup failed",
    );
  }

  const matches = response.data?.data?.matches ?? [];
  const found = response.data?.data?.found;
  if (!found || matches.length === 0) {
    return null;
  }

  return matches[0];
}
