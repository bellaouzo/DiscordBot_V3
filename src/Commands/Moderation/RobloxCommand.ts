import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { createHmac } from "crypto";
import { LoadApiConfig } from "@config/ApiConfig";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, RequestJson } from "@utilities";

interface RobloxBridgeCommandResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly id?: string;
  };
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
      };
}

interface RobloxBridgeSettings {
  readonly url: string;
  readonly apiKey: string;
  readonly urlSigningSecret: string;
  readonly timeoutMs: number;
}

interface RobloxBridgeError {
  readonly code?: string;
  readonly message?: string;
}

interface DiscordModeratorInfo {
  readonly id: string;
  readonly username: string;
  readonly tag: string;
  readonly globalName?: string;
}

interface RobloxPresencePlayer {
  readonly userId: number;
  readonly playerName: string;
  readonly displayName?: string;
}

interface RobloxPresenceMatch {
  readonly serverId: string;
  readonly jobId?: string;
  readonly placeId?: string;
  readonly lastSeen?: number;
  readonly player?: RobloxPresencePlayer;
}

interface RobloxPresenceResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly found?: boolean;
    readonly matches?: RobloxPresenceMatch[];
  };
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
      };
}

interface RobloxCommandResultPayload {
  readonly id?: string;
  readonly ok?: boolean;
  readonly code?: string;
  readonly message?: string;
}

interface RobloxCommandResultResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly commandId?: string;
    readonly result?: RobloxCommandResultPayload;
  };
  readonly error?: string | RobloxBridgeError;
}

interface RobloxApiKeyStatusResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly configured?: boolean;
    readonly guildId?: string;
    readonly keyType?: string;
    readonly targetId?: string;
    readonly groupId?: string;
    readonly universeId?: string;
    readonly createdAt?: number;
    readonly updatedAt?: number;
  };
  readonly error?: string | RobloxBridgeError;
}

/**
 * Bridge group-audit contract: GET /api/v1/roblox/group/audit?guild_id=&player=|user_id=
 * Exactly one of player or user_id. Auth: x-api-key. Error codes: NOT_CONNECTED,
 * KEY_TYPE_EXPERIENCE, INSUFFICIENT_SCOPE, MEMBER_NOT_FOUND, RATE_LIMITED, UPSTREAM_ERROR.
 */
interface RobloxGroupAuditData {
  readonly guildId?: string;
  readonly entries?: readonly unknown[];
  readonly player?: string;
  readonly userId?: string;
}

interface RobloxGroupAuditResponse {
  readonly ok?: boolean;
  readonly data?: RobloxGroupAuditData;
  readonly error?: string | RobloxBridgeError;
}

/**
 * Bridge group/info contract: GET /api/v1/roblox/group/info?guild_id=
 * Requires group API key. Error: NO_GROUP_KEY when key missing or not group type.
 */
interface RobloxGroupInfoData {
  readonly id?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly owner?: { readonly id?: string; readonly type?: string };
  readonly memberCount?: number;
  readonly publicEntryAllowed?: boolean;
  readonly locked?: boolean;
  readonly verified?: boolean;
  readonly createTime?: string;
  readonly updateTime?: string;
  readonly path?: string;
}

interface RobloxGroupInfoResponse {
  readonly ok?: boolean;
  readonly data?: RobloxGroupInfoData;
  readonly error?: string | RobloxBridgeError;
}

/**
 * Follow-up bridge contracts (same auth + error style):
 * - Group rank set: POST /api/v1/roblox/group/rank with guild_id, target (player or user_id), role_id or rank. No group_id; bridge uses stored group key.
 * - DataStore: GET/POST /api/v1/roblox/datastore/... with guild_id, key; bridge uses stored universe key (keyType "user", target_id = Universe ID). No universe_id from bot.
 */

interface RobloxApiKeyDeleteResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly deleted?: boolean;
  };
  readonly error?: string | RobloxBridgeError;
}

interface KickExecutionOutcome {
  readonly kind: "not_found" | "success" | "failure" | "timeout";
  readonly code?: string;
  readonly message?: string;
  readonly commandId?: string;
}

const RESULT_POLL_INTERVAL_MS = 1500;
const RESULT_POLL_TIMEOUT_MS = 20000;

const apiConfig = LoadApiConfig();

function EnsureRobloxBridgeSettings(): RobloxBridgeSettings {
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

function BuildBridgeCommandUrl(baseUrl: string): string {
  return new URL("/api/v1/commands/post", baseUrl).toString();
}

function BuildApiKeySetupUrl(
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

function BuildPresenceFindUrl(baseUrl: string, playerName: string): string {
  const url = new URL("/api/v1/presence/find", baseUrl);
  url.searchParams.set("playerName", playerName);
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

function ExtractErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return undefined;
}

function FormatDiscordTimestamp(value: number | undefined): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }

  const seconds = Math.floor(value / 1000);
  return seconds > 0 ? `<t:${seconds}:f>` : null;
}

async function EnsureAdminAccess(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const embed = EmbedFactory.CreateError({
    title: "Admin Only",
    description:
      "You need Administrator permission to manage Roblox API key settings.",
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
  return false;
}

async function FindPlayerPresence(
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

async function PostKickCommand(
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

  if (!response.ok || !response.data?.ok || !response.data?.data?.id) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to post kick command",
    );
  }

  return response.data.data.id;
}

async function RequestApiKeyStatus(
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

  if (!response.ok || !response.data?.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to fetch Roblox API key status",
    );
  }

  return response.data.data;
}

async function RequestApiKeyDelete(
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

async function RequestGroupAudit(
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

async function RequestGroupInfo(
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
  const code =
    typeof err === "object" && err?.code ? err.code : undefined;
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

function BuildStatusEmbed(options: {
  configured: boolean;
  linkedDiscordUserId?: string;
  keyType?: string;
  targetId?: string;
  createdAt?: number;
  updatedAt?: number;
}) {
  if (!options.configured) {
    return EmbedFactory.CreateError({
      title: "Roblox Not Connected",
      description:
        "No Roblox API key has been configured for this server. Run `/roblox connect` to set one up.",
    });
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Roblox Connected",
    description: "This server has a Roblox Open Cloud API key configured.",
  });

  if (options.linkedDiscordUserId) {
    embed.addFields([
      {
        name: "Configured By",
        value: `<@${options.linkedDiscordUserId}>`,
        inline: true,
      },
    ]);
  }

  if (options.keyType) {
    embed.addFields([
      {
        name: "Key Type",
        value: options.keyType === "group" ? "Group" : "User (Experience)",
        inline: true,
      },
    ]);
  }

  if (options.targetId) {
    const idLabel = options.keyType === "group" ? "Group ID" : "Universe ID";
    embed.addFields([
      {
        name: idLabel,
        value: options.targetId,
        inline: true,
      },
    ]);
  }

  const createdAtText = FormatDiscordTimestamp(options.createdAt);
  if (createdAtText) {
    embed.addFields([
      { name: "Created At", value: createdAtText, inline: true },
    ]);
  }

  const updatedAtText = FormatDiscordTimestamp(options.updatedAt);
  if (updatedAtText) {
    embed.addFields([
      { name: "Updated At", value: updatedAtText, inline: true },
    ]);
  }

  return embed;
}

async function PollKickResult(
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

    if (!response.ok || !response.data?.ok) {
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

    const result = response.data.data?.result;
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

async function ExecuteKickSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const playerName = interaction.options.getString("player", true).trim();
  const reason = interaction.options.getString("reason", true).trim();
  const moderator: DiscordModeratorInfo = {
    id: interaction.user.id,
    username: interaction.user.username,
    tag: interaction.user.tag,
    globalName: interaction.user.globalName ?? undefined,
  };

  if (!playerName || !reason) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Input",
      description: "Player name and reason are required.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  let outcome: KickExecutionOutcome = {
    kind: "failure",
    code: "UNKNOWN",
    message: "No result was returned.",
  };

  try {
    await interactionResponder.WithAction({
      interaction,
      message: {
        embeds: [
          EmbedFactory.Create({
            title: "Processing Roblox Kick",
            description: `Checking active server for **${playerName}**...`,
          }).toJSON(),
        ],
      },
      followUp: () => {
        if (outcome.kind === "not_found") {
          return {
            embeds: [
              EmbedFactory.CreateError({
                title: "Player Not In Server",
                description:
                  "Player is not currently in an active tracked server.",
              }).toJSON(),
            ],
          };
        }

        if (outcome.kind === "success") {
          const embed = EmbedFactory.CreateSuccess({
            title: "Roblox Kick Succeeded",
            description:
              outcome.message?.trim() ||
              `Kick completed for **${playerName}**.`,
          });
          embed.addFields([{ name: "Reason", value: reason, inline: false }]);

          const resultSummary = [outcome.code, outcome.message]
            .filter(Boolean)
            .join(" - ")
            .trim();
          embed.addFields([
            {
              name: "Result",
              value:
                resultSummary ||
                "ACKNOWLEDGED - Command accepted by Roblox bridge.",
              inline: false,
            },
          ]);

          if (outcome.commandId) {
            embed.addFields([
              { name: "Command ID", value: outcome.commandId, inline: false },
            ]);
          }
          return { embeds: [embed.toJSON()] };
        }

        const embed = EmbedFactory.CreateError({
          title:
            outcome.kind === "timeout"
              ? "Roblox Kick Timed Out"
              : "Roblox Kick Failed",
          description:
            outcome.message ??
            "Unable to complete the kick command through the Roblox bridge.",
        });
        if (outcome.code) {
          embed.addFields([
            { name: "Code", value: outcome.code, inline: true },
          ]);
        }
        if (outcome.commandId) {
          embed.addFields([
            { name: "Command ID", value: outcome.commandId, inline: true },
          ]);
        }
        return { embeds: [embed.toJSON()] };
      },
      action: async () => {
        const presenceMatch = await FindPlayerPresence(settings, playerName);
        if (!presenceMatch?.serverId) {
          outcome = { kind: "not_found" };
          return;
        }

        const commandId = await PostKickCommand(
          settings,
          playerName,
          reason,
          presenceMatch.serverId,
          moderator,
        );

        outcome = await PollKickResult(settings, commandId);
      },
    });
  } catch (error) {
    context.logger.Error("Roblox kick command failed", {
      error,
      extra: { playerName, outcome },
    });

    const embed = EmbedFactory.CreateError({
      title: "Roblox Kick Failed",
      description:
        "Unable to send the kick command to the Roblox bridge right now. Please try again later.",
    });

    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  }
}

function GroupAuditErrorTitle(code: string | undefined): string {
  switch (code) {
    case "NOT_CONNECTED":
      return "Roblox Not Connected";
    case "NO_GROUP_KEY":
      return "No Group Key";
    case "KEY_TYPE_EXPERIENCE":
      return "Group Audit Not Available";
    case "INSUFFICIENT_SCOPE":
      return "Insufficient API Key Scope";
    case "MEMBER_NOT_FOUND":
      return "Member Not Found";
    case "RATE_LIMITED":
      return "Rate Limited";
    case "UPSTREAM_ERROR":
      return "Roblox API Error";
    case "INVALID_API_KEY":
      return "Invalid API Key";
    case "SIGNATURE_INVALID":
    case "SIGNATURE_USED":
      return "Setup Link Invalid";
    default:
      return "Group Audit Failed";
  }
}

function GroupAuditErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "NOT_CONNECTED":
      return "No Roblox API key is configured for this server. Run `/roblox connect` to set one up.";
    case "NO_GROUP_KEY":
      return "This server must have a **group** API key configured. Run `/roblox connect` and link a group key.";
    case "KEY_TYPE_EXPERIENCE":
      return "Group audit is only available when this server is linked with a **group** API key. This server is linked with an experience (universe) key.";
    case "INSUFFICIENT_SCOPE":
      return "The configured API key does not have permission to read group membership. Check key scopes in Roblox Creator Hub.";
    case "MEMBER_NOT_FOUND":
      return "The player was not found in the group or the name/ID is invalid.";
    case "RATE_LIMITED":
      return "Too many requests. Please try again in a moment.";
    case "UPSTREAM_ERROR":
      return "The Roblox API returned an error. Please try again later.";
    case "INVALID_API_KEY":
      return "Roblox rejected the API key. Some endpoints (e.g. group info) only support **user (creator)** API keys, not group keys. In Roblox Creator Hub, create a key with the right scopes and reconnect using **User** (experience) if your bridge requires it for this action.";
    case "SIGNATURE_INVALID":
    case "SIGNATURE_USED":
      return "The setup link is invalid or has already been used. Run `/roblox connect` again to get a new link.";
    default:
      return fallback;
  }
}

async function ExecuteGroupAuditSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const player = interaction.options.getString("player", true).trim();
  if (!player) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Input",
      description: "Player name is required.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const status = await RequestApiKeyStatus(settings, guildId);
  if (!status?.configured) {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("NOT_CONNECTED"),
      description: GroupAuditErrorMessage("NOT_CONNECTED", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (status.keyType !== "group") {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("KEY_TYPE_EXPERIENCE"),
      description: GroupAuditErrorMessage("KEY_TYPE_EXPERIENCE", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    const result = await RequestGroupAudit(settings, guildId, { player });
    const data = result.data;
    const entries = data?.entries ?? [];
    const displayName = data?.player ?? data?.userId ?? player;
    const entryCount = Array.isArray(entries) ? entries.length : 0;

    const embed = EmbedFactory.CreateSuccess({
      title: "Group Audit",
      description: `Audit result for **${displayName}** in the linked group.`,
    });
    embed.addFields([
      { name: "Player", value: displayName, inline: true },
      { name: "Entries", value: String(entryCount), inline: true },
    ]);
    if (entryCount > 0 && Array.isArray(entries)) {
      const preview = entries.slice(0, 5).map((e, i) => {
        const row = typeof e === "object" && e !== null && "role" in e
          ? `${(e as { role?: string }).role ?? "—"}`
          : String(e);
        return `${i + 1}. ${row}`;
      }).join("\n");
      const more = entryCount > 5 ? `\n_… and ${entryCount - 5} more_` : "";
      embed.addFields([
        { name: "Details", value: preview + more, inline: false },
      ]);
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    const message = (error as Error).message;
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle(code),
      description: GroupAuditErrorMessage(code, message),
    });
    if (code) {
      embed.addFields([{ name: "Code", value: code, inline: true }]);
    }
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

async function ExecuteGroupInfoSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;

  const status = await RequestApiKeyStatus(settings, guildId);
  if (!status?.configured) {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("NOT_CONNECTED"),
      description: GroupAuditErrorMessage("NOT_CONNECTED", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (status.keyType !== "group") {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("NO_GROUP_KEY"),
      description: GroupAuditErrorMessage("NO_GROUP_KEY", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    const result = await RequestGroupInfo(settings, guildId);
    const data = result.data;

    const embed = EmbedFactory.CreateSuccess({
      title: "Group Info",
      description: data?.displayName
        ? `**${data.displayName}**`
        : "Linked Roblox group.",
    });

    if (data?.id) {
      embed.addFields([{ name: "Group ID", value: data.id, inline: true }]);
    }
    if (data?.displayName) {
      embed.addFields([
        { name: "Name", value: data.displayName, inline: true },
      ]);
    }
    if (data?.memberCount !== undefined && data?.memberCount !== null) {
      embed.addFields([
        { name: "Members", value: String(data.memberCount), inline: true },
      ]);
    }
    if (data?.description !== undefined && data?.description !== "") {
      const desc =
        data.description.length > 1024
          ? `${data.description.slice(0, 1021)}...`
          : data.description;
      embed.addFields([{ name: "Description", value: desc, inline: false }]);
    }
    if (data?.path) {
      embed.addFields([{ name: "Path", value: data.path, inline: false }]);
    }
    if (data?.publicEntryAllowed !== undefined) {
      embed.addFields([
        {
          name: "Public Entry",
          value: data.publicEntryAllowed ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.locked !== undefined) {
      embed.addFields([
        {
          name: "Locked",
          value: data.locked ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.verified !== undefined) {
      embed.addFields([
        {
          name: "Verified",
          value: data.verified ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.owner?.id) {
      embed.addFields([
        {
          name: "Owner ID",
          value: data.owner.id,
          inline: true,
        },
      ]);
    }
    if (data?.createTime) {
      embed.addFields([
        { name: "Created", value: data.createTime, inline: true },
      ]);
    }
    if (data?.updateTime) {
      embed.addFields([
        { name: "Updated", value: data.updateTime, inline: true },
      ]);
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    const message = (error as Error).message;
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle(code),
      description: GroupAuditErrorMessage(code, message),
    });
    if (code) {
      embed.addFields([{ name: "Code", value: code, inline: true }]);
    }
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

async function ExecuteConnectSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const currentUserId = interaction.user.id;

  const existingStatus = await RequestApiKeyStatus(settings, guildId);
  if (existingStatus?.configured) {
    const embed = EmbedFactory.CreateError({
      title: "API Key Already Configured",
      description:
        "A Roblox API key is already configured for this server. Run `/roblox disconnect` first to remove it.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const setupUrl = BuildApiKeySetupUrl(
    settings.url,
    guildId,
    currentUserId,
    settings.urlSigningSecret,
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open Setup Page")
      .setStyle(ButtonStyle.Link)
      .setURL(setupUrl),
  );

  const embed = EmbedFactory.Create({
    title: "Connect Roblox API Key",
    description:
      "Click the button below to open the API key setup page. You will need your Roblox Open Cloud API key and your Universe ID (or Group ID).\n\nAfter completing setup, run `/roblox status` to verify.",
    footer: "After completing setup in browser, run /roblox status.",
  });

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guildId,
    roblox_linked_discord_user_id: currentUserId,
    roblox_linked_at: Date.now(),
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    components: [row.toJSON() as never],
    ephemeral: true,
  });
}

async function ExecuteStatusSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const guildSettings = context.databases.serverDb.GetGuildSettings(guildId);
  const linkedDiscordUserId =
    guildSettings?.roblox_linked_discord_user_id?.trim() || undefined;

  const status = await RequestApiKeyStatus(settings, guildId);
  const configured = Boolean(status?.configured);

  if (!configured) {
    context.databases.serverDb.UpsertGuildSettings({
      guild_id: guildId,
      roblox_linked_discord_user_id: null,
      roblox_linked_at: null,
    });
  }

  const embed = BuildStatusEmbed({
    configured,
    linkedDiscordUserId: configured ? linkedDiscordUserId : undefined,
    keyType: status?.keyType,
    targetId: status?.targetId,
    createdAt: status?.createdAt,
    updatedAt: status?.updatedAt,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function ExecuteDisconnectSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;

  const status = await RequestApiKeyStatus(settings, guildId);
  if (!status?.configured) {
    const embed = EmbedFactory.CreateError({
      title: "Nothing to Disconnect",
      description:
        "No Roblox API key is configured for this server. Run `/roblox connect` first.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    await RequestApiKeyDelete(settings, guildId);
  } catch (error) {
    const embed = EmbedFactory.CreateError({
      title: "Roblox Disconnect Failed",
      description:
        ExtractErrorMessage(error) ??
        "Unable to remove the Roblox API key. Please try again later.",
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guildId,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Roblox Disconnected",
    description: "Successfully removed the Roblox API key for this server.",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function ExecuteRoblox(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  let settings: RobloxBridgeSettings;

  try {
    settings = EnsureRobloxBridgeSettings();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Roblox bridge configuration is invalid.";
    const embed = EmbedFactory.CreateError({
      title: "Roblox Bridge Not Configured",
      description: message,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    if (subcommand === "kick") {
      await ExecuteKickSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "group-audit") {
      await ExecuteGroupAuditSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "group-info") {
      await ExecuteGroupInfoSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "connect") {
      await ExecuteConnectSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "status") {
      await ExecuteStatusSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "disconnect") {
      await ExecuteDisconnectSubcommand(interaction, context, settings);
    }
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error;
    context.logger.Error("Roblox command failed", {
      error: errorDetails,
      extra: { subcommand, userId: interaction.user.id },
    });

    const errorMessage =
      ExtractErrorMessage(error) ??
      "Unable to complete this Roblox action right now. Please try again later.";
    const embed = EmbedFactory.CreateError({
      title: "Roblox Command Failed",
      description: errorMessage,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

export const RobloxCommand = CreateCommand({
  name: "roblox",
  description: "Roblox bridge actions",
  group: "moderation",
  config: Config.admin(),
  execute: ExecuteRoblox,
  configure: (builder) => {
    builder
      .addSubcommand((subcommand) =>
        subcommand
          .setName("kick")
          .setDescription("Kick a Roblox player remotely")
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Roblox player name")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for kicking the player")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("group-audit")
          .setDescription("Look up a player's group membership (group key required)")
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Roblox player name to look up")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("group-info")
          .setDescription("View the linked Roblox group's info (group key required)"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("connect")
          .setDescription("Set up a Roblox Open Cloud API key for this server"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("status")
          .setDescription("View Roblox API key connection status"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("disconnect")
          .setDescription("Remove the Roblox API key for this server"),
      );
  },
});
