import type { Message, SendableChannels, TextChannel } from "discord.js";
import { Events } from "discord.js";
import type { EventContext } from "@events/EventFactory";
import { CreateEvent } from "@events/EventFactory";
import { EmbedFactory, IsModerator, ResolveMessageMember } from "@utilities";
import { AwardChatXp } from "@systems/Leveling/ChatXp";
import { ApplyLevelRoleRewards } from "@systems/Leveling/LevelRewardManager";

async function ExecuteMessageCreateEvent(
  context: EventContext,
  msg: Message,
): Promise<void> {
  if (!msg.guild || !msg.channel.isTextBased() || msg.author.bot) {
    return;
  }

  try {
    const settings = context.databases.serverDb.GetGuildSettings(msg.guild.id);
    const member = await ResolveMessageMember(msg);
    const isStaff = IsModerator(member, settings);

    if (!isStaff) {
      const filters = context.databases.moderationDb.ListLinkFilters(
        msg.guild.id,
      );
      const allow = filters
        .filter((f) => f.type === "allow")
        .map((f) => f.pattern);
      const block = filters
        .filter((f) => f.type === "block")
        .map((f) => f.pattern);
      const content = (msg.content ?? "").toLowerCase();

      const isAllowed = allow.some((pattern) => content.includes(pattern));
      const isBlocked =
        !isAllowed && block.some((pattern) => content.includes(pattern));

      if (isBlocked) {
        try {
          await msg.delete();
        } catch (error) {
          context.logger.Error("Failed to delete blocked message", { error });
        }

        const notice = EmbedFactory.CreateWarning({
          title: "Link Blocked",
          description: "Your message contained a blocked link and was removed.",
        });

        let notified = false;
        try {
          await msg.author.send({ embeds: [notice.toJSON()] });
          notified = true;
        } catch (error) {
          context.logger.Warn("Failed to DM user about blocked link", {
            error,
          });
        }

        if (!notified && settings?.delete_log_channel_id) {
          try {
            const logChannel = await msg.guild.channels.fetch(
              settings.delete_log_channel_id,
            );
            if (logChannel?.isTextBased()) {
              await (logChannel as TextChannel).send({
                content: `<@${msg.author.id}>`,
                embeds: [notice.toJSON()],
              });
            }
          } catch (error) {
            context.logger.Error(
              "Failed to send link block notice to log channel",
              {
                error,
              },
            );
          }
        }

        return;
      }
    }

    try {
      const xpResult = AwardChatXp({
        guildId: msg.guild.id,
        userId: msg.author.id,
        channelId: msg.channel.id,
        messageContent: msg.content ?? "",
        userDb: context.databases.userDb,
        serverDb: context.databases.serverDb,
      });

      if (xpResult.leveledUp && xpResult.newLevel) {
        const xpSettings = context.databases.serverDb.GetGuildXpSettings(
          msg.guild.id,
        );
        const announceChannelId =
          xpSettings.level_up_channel_id ?? msg.channel.id;

        try {
          const announceChannel =
            await context.client.channels.fetch(announceChannelId);
          if (announceChannel?.isTextBased()) {
            const levelEmbed = EmbedFactory.Create({
              title: "Level Up!",
              description: `${msg.author} reached **Level ${xpResult.newLevel}**!`,
              color: 0x57f287,
            });
            await (announceChannel as SendableChannels).send({
              embeds: [levelEmbed.toJSON()],
            });
          }
        } catch (levelError) {
          context.logger.Warn("Failed to send level-up announcement", {
            error: levelError,
          });
        }

        if (
          xpResult.previousLevel !== undefined &&
          msg.member
        ) {
          try {
            await ApplyLevelRoleRewards({
              member: msg.member,
              guild: msg.guild,
              previousLevel: xpResult.previousLevel,
              newLevel: xpResult.newLevel,
              serverDb: context.databases.serverDb,
              logger: context.logger,
            });
          } catch (rewardError) {
            context.logger.Warn("Failed to apply level role rewards", {
              error: rewardError,
            });
          }
        }
      }
    } catch (xpError) {
      context.logger.Error("Failed to award chat XP", { error: xpError });
    }

    const ticket = context.databases.ticketDb.GetTicketByChannel(
      msg.channel.id,
    );
    if (!ticket) {
      return;
    }

    const messageContent = msg.content || "[Embed or Attachment]";
    context.databases.ticketDb.AddMessage(
      ticket.id,
      msg.author.id,
      messageContent,
    );
  } catch (error) {
    context.logger.Error("Failed to process message", { error });
  }
}

export const MessageCreateEvent = CreateEvent({
  name: Events.MessageCreate,
  once: false,
  execute: ExecuteMessageCreateEvent,
});
