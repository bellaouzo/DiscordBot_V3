import type { GuildMember, TextChannel } from "discord.js";
import { Events } from "discord.js";
import type { EventContext } from "@events/EventFactory";
import { CreateEvent } from "@events/EventFactory";
import { EmbedFactory, TryAssignAutorole } from "@utilities";
import { AssignUnverifiedRole } from "@systems/Verification/VerifyMember";

async function SendWelcomeMessage(
  context: EventContext,
  guildMember: GuildMember,
  welcomeChannelId: string,
): Promise<void> {
  const channel = await guildMember.guild.channels.fetch(welcomeChannelId);

  if (!channel) {
    context.logger.Warn("Welcome channel not found", {
      guildId: guildMember.guild.id,
      extra: { channelId: welcomeChannelId },
    });
    return;
  }

  if (!channel.isTextBased()) {
    context.logger.Warn("Welcome channel is not a text channel", {
      guildId: guildMember.guild.id,
      extra: {
        channelId: welcomeChannelId,
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
    extra: { channelId: welcomeChannelId },
  });
}

async function ExecuteGuildMemberAddEvent(
  context: EventContext,
  guildMember: GuildMember,
): Promise<void> {
  context.logger.Debug("GuildMemberAdd event triggered", {
    guildId: guildMember.guild?.id,
    userId: guildMember.user?.id,
  });

  if (!guildMember.guild) {
    context.logger.Debug("GuildMemberAdd: No guild found, skipping");
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    guildMember.guild.id,
  );

  if (!settings) {
    context.logger.Debug("No guild settings found", {
      guildId: guildMember.guild.id,
    });
    return;
  }

  if (settings.welcome_channel_id) {
    try {
      await SendWelcomeMessage(
        context,
        guildMember,
        settings.welcome_channel_id,
      );
    } catch (error) {
      context.logger.Error("Failed to send welcome message", {
        guildId: guildMember.guild.id,
        userId: guildMember.user.id,
        error,
      });
    }
  }

  if (settings.verification_enabled && settings.unverified_role_id) {
    try {
      await AssignUnverifiedRole(guildMember, settings);
      context.logger.Debug("Unverified role assigned", {
        guildId: guildMember.guild.id,
        userId: guildMember.user.id,
        extra: { roleId: settings.unverified_role_id },
      });
    } catch (verificationError) {
      context.logger.Warn("Failed to assign unverified role", {
        guildId: guildMember.guild.id,
        userId: guildMember.user.id,
        error: verificationError,
      });
    }
    return;
  }

  if (settings.autorole_id) {
    try {
      await TryAssignAutorole(guildMember, settings.autorole_id);
      context.logger.Debug("Autorole assigned", {
        guildId: guildMember.guild.id,
        userId: guildMember.user.id,
        extra: { roleId: settings.autorole_id },
      });
    } catch (autoroleError) {
      context.logger.Warn("Failed to assign autorole", {
        guildId: guildMember.guild.id,
        userId: guildMember.user.id,
        error: autoroleError,
      });
    }
  }
}

export const GuildMemberAddEvent = CreateEvent({
  name: Events.GuildMemberAdd,
  once: false,
  execute: ExecuteGuildMemberAddEvent,
});
