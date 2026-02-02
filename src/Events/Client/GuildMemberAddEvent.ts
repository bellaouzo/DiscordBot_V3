import { Events, GuildMember, TextChannel } from "discord.js";
import { CreateEvent, EventContext } from "@events/EventFactory";
import { EmbedFactory } from "@utilities";

async function ExecuteGuildMemberAddEvent(
  context: EventContext,
  guildMember: GuildMember
): Promise<void> {
  context.logger.Debug("GuildMemberAdd event triggered", {
    guildId: guildMember.guild?.id,
    userId: guildMember.user?.id,
  });

  if (!guildMember.guild) {
    context.logger.Debug("GuildMemberAdd: No guild found, skipping");
    return;
  }

  try {
    const settings = context.databases.serverDb.GetGuildSettings(
      guildMember.guild.id
    );

    if (!settings) {
      context.logger.Debug("No guild settings found for welcome message", {
        guildId: guildMember.guild.id,
      });
      return;
    }

    if (!settings.welcome_channel_id) {
      context.logger.Debug("No welcome channel configured", {
        guildId: guildMember.guild.id,
      });
      return;
    }

    const channel = await guildMember.guild.channels.fetch(
      settings.welcome_channel_id
    );

    if (!channel) {
      context.logger.Warn("Welcome channel not found", {
        guildId: guildMember.guild.id,
        extra: {
          channelId: settings.welcome_channel_id,
        },
      });
      return;
    }

    if (!channel.isTextBased()) {
      context.logger.Warn("Welcome channel is not a text channel", {
        guildId: guildMember.guild.id,
        extra: {
          channelId: settings.welcome_channel_id,
          channelType: channel.type,
        },
      });
      return;
    }

    const welcomeEmbed = EmbedFactory.Create({
      title: "Welcome!",
      description: `Welcome to **${guildMember.guild.name}**, ${guildMember}! We're glad to have you here.`,
      color: 0x5865f2,
      thumbnail: guildMember.user.displayAvatarURL(),
      timestamp: true,
    });

    welcomeEmbed.addFields([
      {
        name: "Member Count",
        value: `${guildMember.guild.memberCount}`,
        inline: true,
      },
      {
        name: "Account Created",
        value: `<t:${Math.floor(guildMember.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
    ]);

    await (channel as TextChannel).send({
      content: `${guildMember}`,
      embeds: [welcomeEmbed.toJSON()],
    });

    context.logger.Debug("Welcome message sent", {
      guildId: guildMember.guild.id,
      userId: guildMember.user.id,
      extra: {
        channelId: settings.welcome_channel_id,
      },
    });
  } catch (error) {
    context.logger.Error("Failed to send welcome message", {
      guildId: guildMember.guild.id,
      userId: guildMember.user.id,
      error,
    });
  }
}

export const GuildMemberAddEvent = CreateEvent({
  name: Events.GuildMemberAdd,
  once: false,
  execute: ExecuteGuildMemberAddEvent,
});
