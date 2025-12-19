import { Events, GuildMember, TextChannel } from "discord.js";
import { CreateEvent, EventContext } from "@events/EventFactory";
import { EmbedFactory } from "@utilities";

async function ExecuteGuildMemberAddEvent(
  context: EventContext,
  member: unknown
): Promise<void> {
  const guildMember = member as GuildMember;
  if (!guildMember.guild) {
    return;
  }

  try {
    const settings = context.databases.serverDb.GetGuildSettings(
      guildMember.guild.id
    );

    if (!settings || !settings.welcome_channel_id) {
      return;
    }

    const channel = await guildMember.guild.channels.fetch(
      settings.welcome_channel_id
    );

    if (!channel || !channel.isTextBased()) {
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
  } catch (error) {
    context.logger.Error("Failed to send welcome message", { error });
  }
}

export const GuildMemberAddEvent = CreateEvent({
  name: Events.GuildMemberAdd,
  once: false,
  execute: ExecuteGuildMemberAddEvent,
});
