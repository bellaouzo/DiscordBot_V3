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
  CategoryChannel,
} from "discord.js";
import { TicketDatabase, Ticket } from "@database";
import { Logger } from "@shared/Logger";
import {
  EmbedFactory,
  ComponentFactory,
  CreateChannelManager,
  GuildResourceLocator,
  IsTicketStaff,
} from "@utilities";

export interface TicketManagerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly ticketDb: TicketDatabase;
  readonly guildResourceLocator: GuildResourceLocator;
  readonly ticketCategoryId?: string | null;
  readonly staffRoleIds?: string[];
  readonly ticketLogChannelId?: string | null;
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

    const ticketCategory = await this.ResolveTicketCategory();
    if (!ticketCategory) {
      throw new Error("Unable to resolve ticket category for ticket creation");
    }

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
      permissionOverwrites: await this.CreatePermissionOverwrites(member),
    });

    ticketDb.UpdateTicketChannelId(ticket.id, channel.id);
    ticketDb.UpdateTicketStatus(ticket.id, "open");

    return { ticket, channel };
  }

  async ReopenTicket(options: {
    priorTicketId: number;
    reopenedBy: string;
    reason?: string | null;
    transcriptUrl?: string | null;
  }): Promise<TicketChannelInfo> {
    const prior = this.options.ticketDb.GetTicket(options.priorTicketId);
    if (!prior) {
      throw new Error("Ticket not found.");
    }
    if (prior.status !== "closed") {
      throw new Error("Ticket must be closed before reopening.");
    }

    const member = await this.options.guildResourceLocator.GetMember(
      prior.user_id
    );
    if (!member) {
      throw new Error("Ticket user is no longer in the guild.");
    }

    const ticketCategory = await this.ResolveTicketCategory();
    if (!ticketCategory) {
      throw new Error("Unable to resolve ticket category for ticket reopen");
    }

    const ticket = this.options.ticketDb.CreateTicket({
      user_id: prior.user_id,
      guild_id: prior.guild_id,
      channel_id: null,
      category: prior.category,
    });

    const channelName = `ticket-${String(ticket.id).padStart(4, "0")}-${
      member.user.username
    }`;

    const channel = await this.options.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategory,
      permissionOverwrites: await this.CreatePermissionOverwrites(member),
    });

    this.options.ticketDb.UpdateTicketChannelId(ticket.id, channel.id);
    this.options.ticketDb.UpdateTicketStatus(ticket.id, "open");

    this.options.ticketDb.AddReopenAudit({
      prior_ticket_id: prior.id,
      new_ticket_id: ticket.id,
      guild_id: prior.guild_id,
      reopened_by: options.reopenedBy,
      reason: options.reason ?? null,
      prior_status: prior.status,
      transcript_url: options.transcriptUrl ?? null,
    });

    return { ticket, channel };
  }

  private async CreatePermissionOverwrites(
    member: GuildMember
  ): Promise<OverwriteResolvable[]> {
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

    const uniqueRoleIds = new Set(this.options.staffRoleIds ?? []);
    for (const roleId of uniqueRoleIds) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    const botMember = await this.options.guild.members.fetchMe();
    overwrites.push({
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    });

    return overwrites;
  }

  CreateTicketEmbed(ticket: Ticket): EmbedBuilder {
    const categories = this.options.ticketDb.EnsureCategoryConfigs(
      this.options.guild.id
    );
    const categoryInfo = categories.find((c) => c.value === ticket.category);
    const categoryLabel = categoryInfo
      ? `${categoryInfo.emoji} ${categoryInfo.label}`
      : ticket.category;
    const tags = this.options.ticketDb.ListTicketTags(ticket.id);
    const tagLine =
      tags.length > 0
        ? `\n**Tags:** ${tags.map((tag) => `\`${tag}\``).join(", ")}`
        : "";

    return EmbedFactory.Create({
      title: `🎫 Ticket #${ticket.id}`,
      description: `**Category:** ${categoryLabel}\n**Created by:** <@${ticket.user_id}>${tagLine}\n\nPlease describe your issue below and a staff member will assist you.`,
      color: 0x5865f2,
      footer: `Ticket ID: ${ticket.id}`,
      timestamp: true,
    });
  }

  async SyncTicketChannelEmbed(ticket: Ticket): Promise<void> {
    if (!ticket.channel_id || ticket.status === "closed") {
      return;
    }

    try {
      const fetchedChannel = await this.options.guild.channels.fetch(
        ticket.channel_id
      );
      if (!fetchedChannel || !fetchedChannel.isTextBased()) {
        return;
      }

      const channel = fetchedChannel as TextChannel;
      const messages = await channel.messages.fetch({ limit: 10 });
      const ticketMessage = messages.find((message) =>
        message.embeds.some((embed) =>
          embed.title?.includes(`Ticket #${ticket.id}`)
        )
      );

      if (!ticketMessage) {
        return;
      }

      await ticketMessage.edit({
        embeds: [this.CreateTicketEmbed(ticket).toJSON()],
        components: ticketMessage.components,
      });
    } catch (error) {
      this.options.logger.Warn("Failed to sync ticket channel embed", {
        id: String(ticket.id),
        error,
      });
    }
  }

  CreateTicketButtons(ticketId: number): ActionRowBuilder<ButtonBuilder> {
    return ComponentFactory.CreateActionRow({
      buttons: [
        { label: "Claim Ticket", style: ButtonStyle.Primary, emoji: "📌" },
        { label: "Add User", style: ButtonStyle.Secondary, emoji: "👥" },
        { label: "Remove User", style: ButtonStyle.Secondary, emoji: "👤" },
        { label: "Close Ticket", style: ButtonStyle.Danger, emoji: "🔒" },
      ],
      customIds: [
        `ticket:claim:${ticketId}`,
        `ticket:add:${ticketId}`,
        `ticket:remove:${ticketId}`,
        `ticket:close:${ticketId}`,
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
      if (this.options.ticketLogChannelId) {
        const configured = await this.options.guild.channels.fetch(
          this.options.ticketLogChannelId
        );
        if (configured?.isTextBased()) {
          return configured as TextChannel;
        }
      }

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
      const staffOverwrites: OverwriteResolvable[] = [
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
      ];

      const uniqueRoleIds = new Set(this.options.staffRoleIds ?? []);
      for (const roleId of uniqueRoleIds) {
        staffOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const logsChannel = await this.options.guild.channels.create({
        name: "ticket-logs",
        type: ChannelType.GuildText,
        permissionOverwrites: staffOverwrites,
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

      if (channel.type !== ChannelType.GuildText) {
        return false;
      }

      const textChannel = channel as TextChannel;
      const member = await this.options.guildResourceLocator.GetMember(userId);
      if (!member) {
        return false;
      }

      await textChannel.permissionOverwrites.delete(member);

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
    member: GuildMember | null,
    settings?: {
      adminRoleIds?: string[];
      modRoleIds?: string[];
    } | null
  ): boolean {
    if (!member) {
      return false;
    }

    if (ticket.user_id === userId) {
      return true;
    }

    return IsTicketStaff(member, settings);
  }

  CanUserRemoveParticipants(
    ticket: Ticket,
    userId: string,
    member: GuildMember | null,
    settings?: {
      adminRoleIds?: string[];
      modRoleIds?: string[];
    } | null
  ): boolean {
    if (!member) {
      return false;
    }

    if (ticket.user_id === userId) {
      return true;
    }

    return IsTicketStaff(member, settings);
  }

  private async ResolveTicketCategory(): Promise<CategoryChannel | null> {
    if (this.options.ticketCategoryId) {
      const existing =
        await this.options.guildResourceLocator.GetCategoryChannel(
          this.options.ticketCategoryId
        );
      if (existing) {
        return existing;
      }
    }

    return await this.channelManager.GetOrCreateCategory("Support Tickets");
  }
}

export function CreateTicketManager(
  options: TicketManagerOptions
): TicketManager {
  return new TicketManager(options);
}
