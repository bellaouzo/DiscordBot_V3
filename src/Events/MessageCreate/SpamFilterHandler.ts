import type { Message } from "discord.js";
import { IsModerator, ResolveMessageMember } from "@utilities";
import { SharedSpamDetector } from "@systems/Moderation/SpamDetector";
import {
  EnforceSpamViolation,
  RemoveSpamMessages,
} from "@systems/Moderation/SpamEnforcement";
import type { MessageCreateHandler } from "./types";

function CountMentions(msg: Message): number {
  return (
    msg.mentions.users.size +
    msg.mentions.roles.size +
    (msg.mentions.everyone ? 1 : 0)
  );
}

/** The channel to check against the exempt list; threads inherit their parent's exemption. */
function ResolveFilterChannelIds(msg: Message): string[] {
  const ids = [msg.channelId];
  if (msg.channel.isThread() && msg.channel.parentId) {
    ids.push(msg.channel.parentId);
  }
  return ids;
}

export const SpamFilterHandler: MessageCreateHandler = {
  name: "spam-filter",

  async execute(context, msg) {
    const guild = msg.guild;
    if (!guild) {
      return "continue";
    }

    const settings = context.databases.serverDb.GetGuildSettings(guild.id);
    if (!settings?.spam_filter_enabled) {
      return "continue";
    }

    const { moderationDb } = context.databases;
    const spamSettings = moderationDb.GetSpamFilterSettings(guild.id);
    if (
      ResolveFilterChannelIds(msg).some((id) =>
        spamSettings.exempt_channel_ids.includes(id),
      )
    ) {
      return "continue";
    }

    const member = await ResolveMessageMember(msg);
    if (IsModerator(member, settings)) {
      return "continue";
    }

    const result = SharedSpamDetector.Check(
      {
        guildId: guild.id,
        userId: msg.author.id,
        channelId: msg.channelId,
        messageId: msg.id,
        content: msg.content ?? "",
        mentionCount: CountMentions(msg),
        at: msg.createdTimestamp || Date.now(),
      },
      spamSettings,
    );

    if (result.kind === "clean") {
      return "continue";
    }

    if (result.kind === "suppressed") {
      await RemoveSpamMessages(guild, [result.message], context.logger);
      return "stop";
    }

    await EnforceSpamViolation({
      message: msg,
      member,
      reason: result.reason,
      description: result.description,
      messages: result.messages,
      strikeDecayHours: spamSettings.strike_decay_hours,
      settings,
      moderationDb,
      logger: context.logger,
    });

    return "stop";
  },
};
