import {
  Guild,
  TextChannel,
  CategoryChannel,
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
import { EmbedFactory, ComponentFactory } from "./";

export interface TicketManagerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly ticketDb: TicketDatabase;
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
  private readonly categoryCache = new Map<string, CategoryChannel | null>();
  private readonly logsChannelCache = new Map<string, TextChannel | null>();

  constructor(private readonly options: TicketManagerOptions) {}

  async CreateTicket(options: CreateTicketOptions): Promise<TicketChannelInfo> {
    const { userId, category } = options;
    const { guild, ticketDb, logger } = this.options;

    const member = await guild.members.fetch(userId);
    if (!member) {
      throw new Error(`User ${userId} not found in guild ${guild.id}`);
    }

    const ticketCategory = await this.GetOrCreateTicketCategory();

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

    logger.Info("Ticket created", {
      extra: {
        ticketId: ticket.id,
        userId,
        guildId: guild.id,
        channelId: channel.id,
        category,
      },
    });

    return { ticket, channel };
  }

  private async GetOrCreateTicketCategory(): Promise<CategoryChannel | null> {
    const categoryName = "Support Tickets";
    const cached = this.categoryCache.get(this.options.guild.id);

    if (cached !== undefined) {
      return cached;
    }

    const existingCategories = this.options.guild.channels.cache.filter(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === categoryName
    );

    if (existingCategories.size > 0) {
      const category = existingCategories.first() as CategoryChannel;
      this.categoryCache.set(this.options.guild.id, category);
      return category;
    }

    try {
      const category = await this.options.guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
      });

      this.categoryCache.set(this.options.guild.id, category);
      this.options.logger.Info("Created ticket category", {
        extra: { guildId: this.options.guild.id, categoryId: category.id },
      });

      return category;
    } catch (error) {
      this.options.logger.Error("Failed to create ticket category", { error });
      return null;
    }
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
        { label: "Close Ticket", style: ButtonStyle.Danger, emoji: "🔒" },
      ],
      customIds: [
        `ticket:${interactionId}:claim:${ticketId}`,
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

    if (updated) {
      this.options.logger.Info("Ticket claimed", {
        extra: { ticketId, staffId },
      });
    }

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
    const member = await this.options.guild.members.fetch(userId);
    if (!member) {
      throw new Error(`User ${userId} not found in guild`);
    }
    return member;
  }

  async GetOrCreateTicketLogsChannel(): Promise<TextChannel | null> {
    const cached = this.logsChannelCache.get(this.options.guild.id);
    if (cached !== undefined) {
      return cached;
    }

    const existingChannels = this.options.guild.channels.cache.filter(
      (channel) =>
        channel.type === ChannelType.GuildText && channel.name === "ticket-logs"
    );

    if (existingChannels.size > 0) {
      const logsChannel = existingChannels.first() as TextChannel;
      this.logsChannelCache.set(this.options.guild.id, logsChannel);
      return logsChannel;
    }

    try {
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

      this.logsChannelCache.set(this.options.guild.id, logsChannel);
      this.options.logger.Info("Created ticket logs channel", {
        extra: { guildId: this.options.guild.id, channelId: logsChannel.id },
      });

      return logsChannel;
    } catch (error) {
      this.options.logger.Error("Failed to create ticket logs channel", {
        error,
      });
      return null;
    }
  }
}

export function CreateTicketManager(
  options: TicketManagerOptions
): TicketManager {
  return new TicketManager(options);
}
