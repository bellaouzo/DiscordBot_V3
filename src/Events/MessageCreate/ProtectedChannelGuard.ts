import type { Guild, GuildBasedChannel, Message } from "discord.js";
import type { GuildSettings } from "@database/Server/Types";
import {
  DEFAULT_APPEAL_PANEL_CHANNEL,
  DEFAULT_RULES_PANEL_CHANNEL,
  DEFAULT_TICKET_PANEL_CHANNEL,
} from "@systems/Setup/constants";

export interface ProtectedChannelMatch {
  readonly reason: string;
}

const PANEL_CHANNEL_REASONS: Readonly<Record<string, string>> = {
  [DEFAULT_TICKET_PANEL_CHANNEL]:
    "This channel is for opening support tickets with the panel button only.",
  [DEFAULT_APPEAL_PANEL_CHANNEL]:
    "This channel is for submitting appeals with the panel button only.",
  [DEFAULT_RULES_PANEL_CHANNEL]:
    "This channel is for server rules. Chat belongs in other channels.",
};

export function ResolveProtectedChannelMatch(options: {
  guild: Guild;
  channelId: string;
  channel: GuildBasedChannel | null;
  settings: GuildSettings | null;
}): ProtectedChannelMatch | null {
  const { guild, channelId, channel, settings } = options;

  if (
    settings?.verification_enabled &&
    settings.verification_channel_id &&
    channelId === settings.verification_channel_id
  ) {
    return {
      reason:
        "This is the verification channel. Use the verification panel buttons — chat is not allowed here.",
    };
  }

  const logChannels: Array<{ id: string | null | undefined; reason: string }> =
    [
      {
        id: settings?.command_log_channel_id,
        reason:
          "This is a staff command-log channel. Member chat is not allowed.",
      },
      {
        id: settings?.ticket_log_channel_id,
        reason: "This is a ticket-log channel. Member chat is not allowed.",
      },
      {
        id: settings?.delete_log_channel_id,
        reason: "This is a delete-log channel. Member chat is not allowed.",
      },
      {
        id: settings?.production_log_channel_id,
        reason: "This is a production-log channel. Member chat is not allowed.",
      },
      {
        id: settings?.starboard_channel_id,
        reason:
          "This is the starboard channel. Only starred messages are posted here.",
      },
    ];

  for (const logChannel of logChannels) {
    if (logChannel.id && channelId === logChannel.id) {
      return { reason: logChannel.reason };
    }
  }

  if (guild.rulesChannelId && channelId === guild.rulesChannelId) {
    return {
      reason:
        "This is the server rules channel. Chat belongs in other channels.",
    };
  }

  const channelName = channel?.name?.toLowerCase() ?? null;
  if (channelName && PANEL_CHANNEL_REASONS[channelName]) {
    return { reason: PANEL_CHANNEL_REASONS[channelName] };
  }

  return null;
}

export function BuildProtectedChannelNoticeDescription(
  message: Message,
  reason: string,
): string {
  const channelMention = message.channel.isDMBased()
    ? "this channel"
    : `${message.channel}`;

  return [
    `Your message in ${channelMention} was removed.`,
    "",
    `**Why:** ${reason}`,
  ].join("\n");
}
