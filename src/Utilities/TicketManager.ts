import {
  Guild,
  TextChannel,
  PermissionFlagsBits,
  GuildMember,
  OverwriteResolvable,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { TicketDatabase, Ticket, TICKET_CATEGORIES } from "../Database";
import { Logger } from "../Shared/Logger";
import {
  EmbedFactory,
  ComponentFactory,
  CreateChannelManager,
  GuildResourceLocator,
} from "./";

export interface TicketManagerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly ticketDb: TicketDatabase;
  readonly guildResourceLocator: GuildResourceLocator;
}

export interface CreateTicketOptions {
  readonly userId: string;
  readonly category: string;
}

export interface TicketChannelInfo {
  readonly ticket: Ticket;
  readonly channel: TextChannel;
}

export class TicketManager {
  private readonly channelManager: ReturnType<typeof CreateChannelManager>;

  constructor(private readonly options: TicketManagerOptions) {
    this.channelManager = CreateChannelManager({
      guild: options.guild,
      logger: options.logger,
    });
  }

  async CreateTicket(options: CreateTicketOptions): Promise<TicketChannelInfo> {
    const { userId, category } = options;
    const { guild, ticketDb, guildResourceLocator } = this.options;

    const member = await guildResourceLocator.GetMember(userId);
    if (!member) {
      throw new Error(`User ${userId} not found in guild ${guild.id}`);
    }

    const ticketCategory =
      await this.channelManager.GetOrCreateCategory("Support Tickets");

    const ticket = ticketDb.CreateTicket({
      user_id: userId,
      guild_id: guild.id,
      channel_id: null,
      category,
    });

    const channelName = `ticket-${String(ticket.id).padStart(4, "0")}-${
      member.user.username
    }`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategory,
      permissionOverwrites: this.CreatePermissionOverwrites(member),
    });

    ticketDb.UpdateTicketChannelId(ticket.id, channel.id);
    ticketDb.UpdateTicketStatus(ticket.id, "open");

    return { ticket, channel };
  }

  private CreatePermissionOverwrites(
    member: GuildMember
  ): OverwriteResolvable[] {
    const overwrites: OverwriteResolvable[] = [
      {
        id: this.options.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const staffMembers = this.options.guild.members.cache.filter(
      (m) =>
        m.permissions.has(PermissionFlagsBits.ManageGuild) ||
        m.permissions.has(PermissionFlagsBits.Administrator)
    );

    for (const [, staffMember] of staffMembers) {
      overwrites.push({
        id: staffMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    return overwrites;
  }

  CreateTicketEmbed(ticket: Ticket): EmbedBuilder {
    const categoryInfo = TICKET_CATEGORIES.find(
      (c) => c.value === ticket.category
    );
    const categoryLabel = categoryInfo
      ? `${categoryInfo.emoji} ${categoryInfo.label}`
      : ticket.category;

    return EmbedFactory.Create({
      title: `🎫 Ticket #${ticket.id}`,
      description: `**Category:** ${categoryLabel}\n**Created by:** <@${ticket.user_id}>\n\nPlease describe your issue below and a staff member will assist you.`,
      color: 0x5865f2,
      footer: `Ticket ID: ${ticket.id}`,
      timestamp: true,
    });
  }

  CreateTicketButtons(
    ticketId: number,
    interactionId: string
  ): ActionRowBuilder<ButtonBuilder> {
    return ComponentFactory.CreateActionRow({
      buttons: [
        { label: "Claim Ticket", style: ButtonStyle.Primary, emoji: "📌" },
        { label: "Add User", style: ButtonStyle.Secondary, emoji: "👥" },
        { label: "Remove User", style: ButtonStyle.Secondary, emoji: "👤" },
        { label: "Close Ticket", style: ButtonStyle.Danger, emoji: "🔒" },
      ],
      customIds: [
        `ticket:${interactionId}:claim:${ticketId}`,
        `ticket:${interactionId}:add:${ticketId}`,
        `ticket:${interactionId}:remove:${ticketId}`,
        `ticket:${interactionId}:close:${ticketId}`,
      ],
    });
  }

  async GetTicketFromChannel(channelId: string): Promise<Ticket | null> {
    return this.options.ticketDb.GetTicketByChannel(channelId);
  }

  async ClaimTicket(ticketId: number, staffId: string): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket || ticket.status === "closed") {
      return false;
    }

    const updated = this.options.ticketDb.UpdateTicketStatus(
      ticketId,
      "claimed",
      staffId
    );

    return updated;
  }

  async CloseTicket(
    ticketId: number,
    closerId?: string,
    sendMessageBeforeDelete?: boolean
  ): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket) {
      return false;
    }

    let channel: TextChannel | null = null;

    if (ticket.channel_id) {
      try {
        const fetchedChannel = await this.options.guild.channels.fetch(
          ticket.channel_id
        );
        if (fetchedChannel && fetchedChannel.isTextBased()) {
          channel = fetchedChannel as TextChannel;
        }
      } catch (error) {
        this.options.logger.Error(
          "Failed to fetch ticket channel for closing",
          { error }
        );
      }
    }

    const updated = this.options.ticketDb.CloseTicket(ticketId, closerId);

    if (updated && channel && sendMessageBeforeDelete) {
      try {
        await channel.send({
          embeds: [
            EmbedFactory.CreateTicketClosed(ticketId, closerId || "System"),
          ],
        });
      } catch (error) {
        this.options.logger.Error("Failed to send close message", { error });
      }
    }

    if (updated && channel) {
      setTimeout(async () => {
        try {
          await channel!.delete("Ticket closed (auto-delete)");
        } catch (error) {
          this.options.logger.Error("Failed to delete ticket channel", {
            error,
            extra: { ticketId, channelId: channel!.id },
          });
        }
      }, 10000);
    }

    return updated;
  }

  async GetUserTickets(
    userId: string,
    guildId: string,
    status?: string
  ): Promise<Ticket[]> {
    return this.options.ticketDb.GetUserTickets(userId, guildId, status);
  }

  async EnsureGuildMember(userId: string): Promise<GuildMember> {
    const member = await this.options.guildResourceLocator.GetMember(userId);
    if (!member) {
      throw new Error(`User ${userId} not found in guild`);
    }
    return member;
  }

  async GetOrCreateTicketLogsChannel(): Promise<TextChannel | null> {
    try {
      const cachedChannel = this.options.guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.name.toLowerCase() === "ticket-logs"
      );

      if (cachedChannel) {
        return cachedChannel as TextChannel;
      }

      const fetchedChannels = await this.options.guild.channels.fetch();
      const existingChannel = fetchedChannels.find(
        (channel) =>
          channel &&
          channel.type === ChannelType.GuildText &&
          channel.name.toLowerCase() === "ticket-logs"
      );

      if (existingChannel) {
        return existingChannel as TextChannel;
      }

      const botMember = await this.options.guild.members.fetchMe();
      const logsChannel = await this.options.guild.channels.create({
        name: "ticket-logs",
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: this.options.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: botMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      return logsChannel;
    } catch (error) {
      this.options.logger.Error("Failed to create ticket logs channel", {
        error,
      });
      return null;
    }
  }

  async AddUserToTicket(
    ticketId: number,
    userId: string,
    addedBy: string
  ): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket || !ticket.channel_id) {
      return false;
    }

    try {
      const channel = await this.options.guild.channels.fetch(
        ticket.channel_id
      );
      if (!channel || !channel.isTextBased()) {
        return false;
      }

      // Ensure we have a TextChannel for permission overwrites
      if (channel.type !== ChannelType.GuildText) {
        return false;
      }

      const textChannel = channel as TextChannel;
      const member = await this.options.guildResourceLocator.GetMember(userId);
      if (!member) {
        return false;
      }

      await textChannel.permissionOverwrites.create(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      this.options.ticketDb.AddParticipant(ticketId, userId, addedBy);

      return true;
    } catch (error) {
      this.options.logger.Error("Failed to add user to ticket", {
        error,
        extra: { ticketId, userId, addedBy },
      });
      return false;
    }
  }

  async RemoveUserFromTicket(
    ticketId: number,
    userId: string,
    removedBy: string
  ): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket || !ticket.channel_id) {
      return false;
    }

    // Prevent removing the ticket owner
    if (ticket.user_id === userId) {
      return false;
    }

    try {
      const channel = await this.options.guild.channels.fetch(
        ticket.channel_id
      );
      if (!channel || !channel.isTextBased()) {
        return false;
      }

      // Ensure we have a TextChannel for permission overwrites
      if (channel.type !== ChannelType.GuildText) {
        return false;
      }

      const textChannel = channel as TextChannel;
      const member = await this.options.guildResourceLocator.GetMember(userId);
      if (!member) {
        return false;
      }

      // Remove channel permissions
      await textChannel.permissionOverwrites.delete(member);

      // Mark participant as removed in database
      const success = this.options.ticketDb.RemoveParticipant(
        ticketId,
        userId,
        removedBy
      );

      return success;
    } catch (error) {
      this.options.logger.Error("Failed to remove user from ticket", {
        error,
        extra: { ticketId, userId, removedBy },
      });
      return false;
    }
  }

  CanUserAddParticipants(
    ticket: Ticket,
    userId: string,
    member: GuildMember | null
  ): boolean {
    if (!member) {
      return false;
    }

    if (ticket.user_id === userId) {
      return true;
    }

    return (
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions.has(PermissionFlagsBits.Administrator)
    );
  }

  CanUserRemoveParticipants(
    ticket: Ticket,
    userId: string,
    member: GuildMember | null
  ): boolean {
    if (!member) {
      return false;
    }

    if (ticket.user_id === userId) {
      return true;
    }

    return (
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions.has(PermissionFlagsBits.Administrator)
    );
  }
}

export function CreateTicketManager(
  options: TicketManagerOptions
): TicketManager {
  return new TicketManager(options);
}
