import type { Guild, GuildMember, Message, TextChannel } from "discord.js";
import type { ModerationDatabase } from "@database";
import type { GuildSettings } from "@database/Server/Types";
import type { Logger } from "@shared/Logger";
import { EmbedFactory } from "@utilities";
import type { SpamMessageRef, SpamReason } from "./SpamDetector";
import type { SpamPunishment } from "./SpamEscalation";
import { ResolveSpamPunishment } from "./SpamEscalation";

const NOTICE_DELETE_MS = 10_000;
const HOUR_MS = 60 * 60 * 1000;

const REASON_TITLES: Record<SpamReason, string> = {
  flood: "Message flood",
  duplicate: "Repeated messages",
  mentions: "Mass mentions",
};

export interface SpamEnforcementOptions {
  readonly message: Message;
  readonly member: GuildMember | null;
  readonly reason: SpamReason;
  readonly description: string;
  readonly messages: readonly SpamMessageRef[];
  readonly strikeDecayHours: number;
  readonly settings: GuildSettings | null;
  readonly moderationDb: ModerationDatabase;
  readonly logger: Logger;
}

export interface SpamEnforcementResult {
  readonly strikeNumber: number;
  readonly punishment: SpamPunishment;
  /** False when a timeout was due but the bot could not apply it. */
  readonly applied: boolean;
}

/** Deletes messages, bulk per channel where possible. Failures are logged, never thrown. */
export async function RemoveSpamMessages(
  guild: Guild,
  messages: readonly SpamMessageRef[],
  logger: Logger,
): Promise<void> {
  const byChannel = new Map<string, string[]>();
  for (const ref of messages) {
    const ids = byChannel.get(ref.channelId) ?? [];
    ids.push(ref.messageId);
    byChannel.set(ref.channelId, ids);
  }

  for (const [channelId, ids] of byChannel) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) {
      continue;
    }
    const textChannel = channel as TextChannel;
    try {
      if (ids.length === 1) {
        await textChannel.messages.delete(ids[0]);
      } else {
        await textChannel.bulkDelete(ids, true);
      }
    } catch (error) {
      logger.Warn("Failed to delete spam messages", {
        error,
        extra: { guildId: guild.id, channelId, count: ids.length },
      });
    }
  }
}

async function ApplyTimeout(
  options: SpamEnforcementOptions,
  punishment: SpamPunishment,
  reasonText: string,
): Promise<boolean> {
  const { member, message } = options;
  if (punishment.action !== "timeout" || punishment.durationMs === null) {
    return true;
  }
  if (!member?.moderatable) {
    return false;
  }

  try {
    await member.timeout(punishment.durationMs, reasonText);
    options.moderationDb.AddTempAction({
      action: "mute",
      guild_id: member.guild.id,
      user_id: member.id,
      moderator_id: message.client.user.id,
      reason: reasonText,
      expires_at: Date.now() + punishment.durationMs,
    });
    return true;
  } catch (error) {
    options.logger.Warn("Failed to time out spammer", {
      error,
      extra: { guildId: member.guild.id, userId: member.id },
    });
    return false;
  }
}

async function SendChannelNotice(
  options: SpamEnforcementOptions,
  result: SpamEnforcementResult,
): Promise<void> {
  const { message } = options;
  const outcome = result.applied
    ? result.punishment.label
    : "Warning (could not apply timeout)";
  const embed = EmbedFactory.CreateWarning({
    title: "🚫 Spam Removed",
    description: [
      `${message.author}, your messages were removed: **${REASON_TITLES[options.reason]}**.`,
      `Strike **${result.strikeNumber}** · ${outcome}`,
    ].join("\n"),
  });

  try {
    const sent = await (message.channel as TextChannel).send({
      embeds: [embed.toJSON()],
      allowedMentions: { users: [message.author.id] },
    });
    setTimeout(() => {
      void sent.delete().catch(() => undefined);
    }, NOTICE_DELETE_MS);
  } catch (error) {
    options.logger.Debug("Failed to send spam notice", { error });
  }
}

async function SendDirectMessage(
  options: SpamEnforcementOptions,
  result: SpamEnforcementResult,
): Promise<void> {
  const { message } = options;
  const guildName = message.guild?.name ?? "the server";
  const lines = [
    `Your messages in **${guildName}** were removed by the spam filter.`,
    `**Reason:** ${options.description}`,
    `**Strike:** ${result.strikeNumber} · ${result.applied ? result.punishment.label : "Warning"}`,
    "",
    `Strikes expire after ${options.strikeDecayHours} hours. Further spam escalates the penalty.`,
  ];
  try {
    await message.author.send({
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Spam Filter",
          description: lines.join("\n"),
        }).toJSON(),
      ],
    });
  } catch {
    // DMs closed; the channel notice already told them.
  }
}

async function LogToStaff(
  options: SpamEnforcementOptions,
  result: SpamEnforcementResult,
): Promise<void> {
  const { message, settings } = options;
  const logChannelId =
    settings?.delete_log_channel_id ?? settings?.command_log_channel_id;
  if (!logChannelId || !message.guild) {
    return;
  }

  const embed = EmbedFactory.CreateWarning({
    title: "🚫 Spam Filter",
    description: `${message.author} (${message.author.id}) in ${message.channel}`,
  });
  embed.addFields(
    { name: "Reason", value: options.description, inline: false },
    {
      name: "Action",
      value: result.applied
        ? result.punishment.label
        : `${result.punishment.label} failed (missing permissions or role hierarchy); warned instead`,
      inline: true,
    },
    { name: "Strike", value: String(result.strikeNumber), inline: true },
    {
      name: "Messages removed",
      value: String(options.messages.length),
      inline: true,
    },
  );

  try {
    const channel = await message.guild.channels.fetch(logChannelId);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed.toJSON()] });
    }
  } catch (error) {
    options.logger.Warn("Failed to log spam action", { error });
  }
}

/**
 * Punishes a spam violation: removes the messages, records a strike, applies the escalation
 * step for the member's active strike count, then notifies the member and staff.
 */
export async function EnforceSpamViolation(
  options: SpamEnforcementOptions,
): Promise<SpamEnforcementResult> {
  const { message, moderationDb } = options;
  const guild = message.guild;
  if (!guild) {
    throw new Error("Spam enforcement requires a guild message");
  }

  await RemoveSpamMessages(guild, options.messages, options.logger);

  const activeStrikes = moderationDb.CountSpamStrikesSince({
    guild_id: guild.id,
    user_id: message.author.id,
    since: Date.now() - options.strikeDecayHours * HOUR_MS,
  });
  const strikeNumber = activeStrikes + 1;
  const punishment = ResolveSpamPunishment(strikeNumber);
  const reasonText = `[Spam filter] ${options.description}`;
  const applied = await ApplyTimeout(options, punishment, reasonText);

  moderationDb.AddSpamStrike({
    guild_id: guild.id,
    user_id: message.author.id,
    reason: options.description,
    action: applied ? punishment.action : "warn",
    duration_ms: applied ? punishment.durationMs : null,
  });

  const result: SpamEnforcementResult = { strikeNumber, punishment, applied };
  await Promise.all([
    SendChannelNotice(options, result),
    SendDirectMessage(options, result),
    LogToStaff(options, result),
  ]);
  return result;
}
