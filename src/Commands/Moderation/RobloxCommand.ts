import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
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

interface RobloxAuthUrlResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly authUrl?: string;
    readonly launchUrl?: string;
    readonly state?: string;
  };
  readonly error?: string | RobloxBridgeError;
}

interface RobloxLinkStatusResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly linked?: boolean;
    readonly linkedAt?: number;
    readonly expiresAt?: number;
    readonly robloxUserId?: number | null;
    readonly robloxUsername?: string | null;
    readonly robloxDisplayName?: string | null;
  };
  readonly error?: string | RobloxBridgeError;
}

interface RobloxUnlinkResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly unlinked?: boolean;
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

function BuildRobloxAuthUrlUrl(
  baseUrl: string,
  guildId: string,
  userId: string
): string {
  const url = new URL("/api/v1/roblox/auth/url", baseUrl);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function BuildRobloxLinkStatusUrl(
  baseUrl: string,
  guildId: string,
  userId: string
): string {
  const url = new URL("/api/v1/roblox/link/status", baseUrl);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function BuildRobloxLinkUnlinkUrl(
  baseUrl: string,
  guildId: string,
  userId: string
): string {
  const url = new URL("/api/v1/roblox/link", baseUrl);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("user_id", userId);
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

async function EnsureOAuthAdminAccess(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const embed = EmbedFactory.CreateError({
    title: "Admin Only",
    description: "You need Administrator permission to manage Roblox OAuth.",
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
  return false;
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

async function RequestOAuthLinkUrl(
  settings: RobloxBridgeSettings,
  guildId: string,
  userId: string
): Promise<string> {
  const response = await RequestJson<RobloxAuthUrlResponse>(
    BuildRobloxAuthUrlUrl(settings.url, guildId, userId),
    {
      method: "GET",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    }
  );

  if (!response.ok || !response.data?.ok || !response.data.data) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to create Roblox OAuth link URL"
    );
  }

  const launchUrl = response.data.data.launchUrl?.trim();
  const authUrl = response.data.data.authUrl?.trim();
  const buttonUrl = launchUrl || authUrl;
  if (!buttonUrl) {
    throw new Error("Missing OAuth launch URL");
  }

  return buttonUrl;
}

async function RequestOAuthLinkStatus(
  settings: RobloxBridgeSettings,
  guildId: string,
  userId: string
): Promise<RobloxLinkStatusResponse["data"]> {
  const response = await RequestJson<RobloxLinkStatusResponse>(
    BuildRobloxLinkStatusUrl(settings.url, guildId, userId),
    {
      method: "GET",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    }
  );

  if (!response.ok || !response.data?.ok || !response.data.data) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to fetch Roblox link status"
    );
  }

  return response.data.data;
}

async function RequestOAuthUnlink(
  settings: RobloxBridgeSettings,
  guildId: string,
  userId: string
): Promise<void> {
  const response = await RequestJson<RobloxUnlinkResponse>(
    BuildRobloxLinkUnlinkUrl(settings.url, guildId, userId),
    {
      method: "DELETE",
      headers: {
        "x-api-key": settings.apiKey,
        "User-Agent": "DiscordBotV3/RobloxCommand",
      },
      timeoutMs: settings.timeoutMs,
    }
  );

  if (!response.ok || !response.data?.ok) {
    throw new Error(
      ExtractErrorMessage(response.data?.error) ??
        response.error ??
        "Failed to unlink Roblox OAuth account"
    );
  }
}

function GetGuildLinkedDiscordUserId(
  context: CommandContext,
  guildId: string
): string | null {
  const settings = context.databases.serverDb.GetGuildSettings(guildId);
  const linkedUserId = settings?.roblox_linked_discord_user_id?.trim();
  return linkedUserId && linkedUserId.length > 0 ? linkedUserId : null;
}

function BuildStatusEmbed(options: {
  linked: boolean;
  linkedDiscordUserId?: string;
  linkedAt?: number;
  expiresAt?: number;
  robloxUserId?: number | null;
  robloxUsername?: string | null;
  robloxDisplayName?: string | null;
}) {
  if (!options.linked) {
    return EmbedFactory.CreateError({
      title: "Roblox Not Linked",
      description:
        "No active Roblox OAuth link was found for this guild/user pair. Run `/roblox connect` to start linking.",
    });
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Roblox Connected",
    description: "This server has an active Roblox OAuth link.",
  });

  if (options.linkedDiscordUserId) {
    embed.addFields([
      {
        name: "Linked By",
        value: `<@${options.linkedDiscordUserId}>`,
        inline: true,
      },
    ]);
  }

  const linkedAtText = FormatDiscordTimestamp(options.linkedAt);
  if (linkedAtText) {
    embed.addFields([{ name: "Linked At", value: linkedAtText, inline: true }]);
  }

  const expiresAtText = FormatDiscordTimestamp(options.expiresAt);
  if (expiresAtText) {
    embed.addFields([{ name: "Token Expires", value: expiresAtText, inline: true }]);
  }

  const username = options.robloxUsername?.trim() || null;
  const displayName = options.robloxDisplayName?.trim() || null;
  const robloxUserId = options.robloxUserId ?? null;
  const robloxAccountLabel =
    displayName && username
      ? `${displayName} (@${username})`
      : username
        ? `@${username}`
        : displayName
          ? displayName
          : "Unknown Roblox account";

  embed.addFields([
    {
      name: "Roblox Account",
      value: robloxAccountLabel,
      inline: true,
    },
  ]);

  if (robloxUserId !== null && robloxUserId !== undefined) {
    embed.addFields([
      {
        name: "Roblox User ID",
        value: String(robloxUserId),
        inline: true,
      },
    ]);
  }

  return embed;
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

async function ExecuteKickSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings
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

async function ExecuteConnectSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const hasAccess = await EnsureOAuthAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const currentUserId = interaction.user.id;
  const existingLinkedUserId = GetGuildLinkedDiscordUserId(context, guildId);

  if (existingLinkedUserId) {
    const existingStatus = await RequestOAuthLinkStatus(
      settings,
      guildId,
      existingLinkedUserId
    );

    if (existingStatus?.linked) {
      const embed = EmbedFactory.CreateError({
        title: "Account Already Linked",
        description: `A Roblox account is already linked for this server by <@${existingLinkedUserId}>. Run \`/roblox disconnect\` first.`,
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
  }

  const currentStatus = await RequestOAuthLinkStatus(settings, guildId, currentUserId);
  if (currentStatus?.linked) {
    const linkedAt = currentStatus.linkedAt ?? Date.now();
    context.databases.serverDb.UpsertGuildSettings({
      guild_id: guildId,
      roblox_linked_discord_user_id: currentUserId,
      roblox_linked_at: linkedAt,
    });

    const embed = BuildStatusEmbed({
      linked: true,
      linkedDiscordUserId: currentUserId,
      linkedAt,
      expiresAt: currentStatus.expiresAt,
      robloxUserId: currentStatus.robloxUserId,
      robloxUsername: currentStatus.robloxUsername,
      robloxDisplayName: currentStatus.robloxDisplayName,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const buttonUrl = await RequestOAuthLinkUrl(
    settings,
    guildId,
    currentUserId
  );

  const checkStatusButtonRegistration = componentRouter.RegisterButton({
    ownerId: currentUserId,
    expiresInMs: 1000 * 60 * 10,
    handler: async (buttonInteraction: ButtonInteraction) => {
      const statusAfterAuth = await RequestOAuthLinkStatus(
        settings,
        guildId,
        currentUserId
      );
      const linked = Boolean(statusAfterAuth?.linked);

      if (linked) {
        const linkedAt = statusAfterAuth?.linkedAt ?? Date.now();
        context.databases.serverDb.UpsertGuildSettings({
          guild_id: guildId,
          roblox_linked_discord_user_id: currentUserId,
          roblox_linked_at: linkedAt,
        });
      }

      const embed = BuildStatusEmbed({
        linked,
        linkedDiscordUserId: linked ? currentUserId : undefined,
        linkedAt: statusAfterAuth?.linkedAt,
        expiresAt: statusAfterAuth?.expiresAt,
        robloxUserId: statusAfterAuth?.robloxUserId,
        robloxUsername: statusAfterAuth?.robloxUsername,
        robloxDisplayName: statusAfterAuth?.robloxDisplayName,
      });

      const components = linked
        ? []
        : [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setLabel("Connect Roblox")
                .setStyle(ButtonStyle.Link)
                .setURL(buttonUrl),
              new ButtonBuilder()
                .setCustomId(checkStatusButtonRegistration.customId)
                .setLabel("Check Link Status")
                .setStyle(ButtonStyle.Secondary)
            ),
          ];

      await buttonResponder.Update(buttonInteraction, {
        embeds: [embed.toJSON()],
        components: components.map((row) => row.toJSON()) as never,
      });
    },
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Connect Roblox")
      .setStyle(ButtonStyle.Link)
      .setURL(buttonUrl),
    new ButtonBuilder()
      .setCustomId(checkStatusButtonRegistration.customId)
      .setLabel("Check Link Status")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = EmbedFactory.Create({
    title: "Connect Roblox Account",
    description:
      "Use the button below to connect your Roblox account for this server, then click **Check Link Status** after you finish in the browser.\n\nCurrent OAuth scope is limited to basic identity (`openid/profile`). Group actions will require additional approved scopes later.",
    footer: "After completing OAuth in browser, run /roblox status.",
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
  settings: RobloxBridgeSettings
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureOAuthAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const targetUserId =
    GetGuildLinkedDiscordUserId(context, guildId) ?? interaction.user.id;

  const status = await RequestOAuthLinkStatus(
    settings,
    guildId,
    targetUserId
  );
  const linked = Boolean(status?.linked);

  if (linked) {
    const linkedAt = status?.linkedAt ?? Date.now();
    context.databases.serverDb.UpsertGuildSettings({
      guild_id: guildId,
      roblox_linked_discord_user_id: targetUserId,
      roblox_linked_at: linkedAt,
    });

    const embed = BuildStatusEmbed({
      linked: true,
      linkedDiscordUserId: targetUserId,
      linkedAt,
      expiresAt: status?.expiresAt,
      robloxUserId: status?.robloxUserId,
      robloxUsername: status?.robloxUsername,
      robloxDisplayName: status?.robloxDisplayName,
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

  const embed = BuildStatusEmbed({ linked: false });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function ExecuteDisconnectSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureOAuthAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;
  const linkedUserId = GetGuildLinkedDiscordUserId(context, guildId);
  const targetUserId = linkedUserId ?? interaction.user.id;

  const status = await RequestOAuthLinkStatus(
    settings,
    guildId,
    targetUserId
  );
  if (!status?.linked) {
    const embed = EmbedFactory.CreateError({
      title: "Nothing to Disconnect",
      description:
        "No Roblox account is connected for this server. Run `/roblox connect` first.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    await RequestOAuthUnlink(settings, guildId, targetUserId);
  } catch (error) {
    const embed = EmbedFactory.CreateError({
      title: "Roblox Disconnect Failed",
      description:
        ExtractErrorMessage(error) ??
        "Unable to unlink the Roblox OAuth connection from backend. Please try again later.",
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
    title: "Roblox Disconnect Complete",
    description:
      "Successfully unlinked Roblox OAuth for this server.",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function ExecuteRoblox(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("connect")
        .setDescription("Connect Roblox OAuth for this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("View Roblox OAuth connection status")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disconnect")
        .setDescription("Clear bot-side Roblox connection metadata")
    );
  },
});
