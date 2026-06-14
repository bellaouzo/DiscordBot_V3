import type { SendableChannels } from "discord.js";
import { EmbedFactory } from "@utilities";
import { AwardChatXp } from "@systems/Leveling/ChatXp";
import { ApplyLevelRoleRewards } from "@systems/Leveling/LevelRewardManager";
import type { MessageCreateHandler } from "./types";

export const ChatXpHandler: MessageCreateHandler = {
  name: "chat-xp",

  async execute(context, msg) {
    const guild = msg.guild;
    if (!guild) {
      return "continue";
    }

    try {
      const xpResult = AwardChatXp({
        guildId: guild.id,
        userId: msg.author.id,
        channelId: msg.channel.id,
        messageContent: msg.content ?? "",
        userDb: context.databases.userDb,
        serverDb: context.databases.serverDb,
      });

      if (xpResult.leveledUp && xpResult.newLevel) {
        const xpSettings = context.databases.serverDb.GetGuildXpSettings(
          guild.id,
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

        if (xpResult.previousLevel !== undefined && msg.member) {
          try {
            await ApplyLevelRoleRewards({
              member: msg.member,
              guild,
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

    return "continue";
  },
};
