import { createHmac } from "crypto";
import { LoadApiConfig } from "@config/ApiConfig";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";

const apiConfig = LoadApiConfig();

export function EnsureRobloxBridgeSettings(): RobloxBridgeSettings {
  const url = apiConfig.robloxBridge.url.trim();
  const apiKey = apiConfig.robloxBridge.apiKey.trim();
  const urlSigningSecret = apiConfig.robloxBridge.urlSigningSecret.trim();

  if (!url) {
    throw new Error(
      "Roblox bridge API URL is not configured. Set ROBLOX_BRIDGE_API_URL.",
    );
  }

  if (!apiKey) {
    throw new Error(
      "Roblox bridge API key is not configured. Set ROBLOX_BRIDGE_API_KEY.",
    );
  }

  if (!urlSigningSecret) {
    throw new Error(
      "Roblox bridge URL signing secret is not configured. Set ROBLOX_BRIDGE_URL_SIGNING_SECRET.",
    );
  }

  return {
    url,
    apiKey,
    urlSigningSecret,
    timeoutMs: apiConfig.robloxBridge.timeoutMs,
  };
}

export function BuildApiKeySetupUrl(
  baseUrl: string,
  guildId: string,
  userId: string,
  urlSigningSecret: string,
): string {
  const url = new URL("/roblox/apikey", baseUrl);
  const expires = Math.floor(Date.now() / 1000) + 900;

  const canonical = `expires=${expires}&guild_id=${guildId}&user_id=${userId}`;
  const sig = createHmac("sha256", urlSigningSecret)
    .update(canonical)
    .digest("hex");

  url.searchParams.set("expires", String(expires));
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("sig", sig);
  url.searchParams.set("user_id", userId);
  return url.toString();
}
