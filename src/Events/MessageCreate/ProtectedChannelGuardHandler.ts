import type { Message, TextChannel } from "discord.js";
import { EmbedFactory, IsModerator, ResolveMessageMember } from "@utilities";
import type { Logger } from "@shared/Logger";
import type { MessageCreateHandler } from "./types";
import {
  BuildProtectedChannelNoticeDescription,
  ResolveProtectedChannelMatch,
} from "./ProtectedChannelGuard";

const NOTICE_DELETE_MS = 12_000;

async function SendProtectedChannelNotice(options: {
  message: Message;
  reason: string;
  logger: Logger;
}): Promise<void> {
  const { message, reason, logger } = options;
  const channel = message.channel;

  if (!channel.isTextBased() || channel.isDMBased()) {
    return;
  }

  const notice = EmbedFactory.CreateWarning({
    title: "Message Removed",
    description: BuildProtectedChannelNoticeDescription(message, reason),
  });

  try {
    const sent = await (channel as TextChannel).send({
      content: `${message.author}`,
      embeds: [notice.toJSON()],
      allowedMentions: { users: [message.author.id] },
    });

    setTimeout(() => {
      void sent.delete().catch((error) => {
        logger.Debug("Failed to delete protected-channel notice", {
          error,
          extra: {
            guildId: message.guild?.id,
            channelId: message.channelId,
            messageId: sent.id,
          },
        });
      });
    }, NOTICE_DELETE_MS);
  } catch (error) {
    logger.Warn("Failed to send protected-channel delete notice", {
      error,
      extra: {
        guildId: message.guild?.id,
        channelId: message.channelId,
        userId: message.author.id,
      },
    });
  }
}

export const ProtectedChannelGuardHandler: MessageCreateHandler = {
  name: "protected-channel-guard",

  async execute(context, msg) {
    const guild = msg.guild;
    if (!guild) {
      return "continue";
    }

    const settings = context.databases.serverDb.GetGuildSettings(guild.id);
    const member = await ResolveMessageMember(msg);

    if (IsModerator(member, settings)) {
      return "continue";
    }

    const match = ResolveProtectedChannelMatch({
      guild,
      channelId: msg.channelId,
      channel: msg.channel.isDMBased() ? null : msg.channel,
      settings,
    });

    if (!match) {
      return "continue";
    }

    try {
      await msg.delete();
    } catch (error) {
      context.logger.Warn("Failed to delete message in protected channel", {
        error,
        extra: {
          guildId: guild.id,
          channelId: msg.channelId,
          messageId: msg.id,
        },
      });
      return "stop";
    }

    await SendProtectedChannelNotice({
      message: msg,
      reason: match.reason,
      logger: context.logger,
    });

    return "stop";
  },
};

/** @deprecated Use ProtectedChannelGuardHandler */
export const VerificationChannelGuardHandler = ProtectedChannelGuardHandler;
