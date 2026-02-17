import { ChatInputCommandInteraction } from "discord.js";
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
  readonly timeoutMs: number;
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
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
      };
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

  if (!url) {
    throw new Error(
      "Roblox bridge API URL is not configured. Set ROBLOX_BRIDGE_API_URL."
    );
  }

  if (!apiKey) {
    throw new Error(
      "Roblox bridge API key is not configured. Set ROBLOX_BRIDGE_API_KEY."
    );
  }

  return {
    url,
    apiKey,
    timeoutMs: apiConfig.robloxBridge.timeoutMs,
  };
}

function BuildBridgeCommandUrl(baseUrl: string): string {
  return new URL("/api/v1/commands/post", baseUrl).toString();
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

async function FindPlayerPresence(
  settings: RobloxBridgeSettings,
  playerName: string
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
    }
  );

  if (!response.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Presence lookup failed"
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
  moderator: DiscordModeratorInfo
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
    }
  );

  if (!response.ok || !response.data?.ok || !response.data?.data?.id) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to post kick command"
    );
  }

  return response.data.data.id;
}

async function PollKickResult(
  settings: RobloxBridgeSettings,
  commandId: string
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
      }
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

async function ExecuteRoblox(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand !== "kick") {
    return;
  }

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

  let settings: RobloxBridgeSettings;

  try {
    settings = EnsureRobloxBridgeSettings();
    BuildBridgeCommandUrl(settings.url);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Roblox bridge configuration is invalid.";
    const embed = EmbedFactory.CreateError({
      title: "Roblox Bridge Not Configured",
      description: message,
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
          embed.addFields([{ name: "Code", value: outcome.code, inline: true }]);
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
          moderator
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

export const RobloxCommand = CreateCommand({
  name: "roblox",
  description: "Roblox bridge actions",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteRoblox,
  configure: (builder) => {
    builder.addSubcommand((subcommand) =>
      subcommand
        .setName("kick")
        .setDescription("Kick a Roblox player remotely")
        .addStringOption((option) =>
          option
            .setName("player")
            .setDescription("Roblox player name")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Reason for kicking the player")
            .setRequired(true)
        )
    );
  },
});
