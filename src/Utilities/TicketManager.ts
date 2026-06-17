import type {
  Guild,
  TextChannel,
  GuildMember,
  OverwriteResolvable,
  CategoryChannel,
} from "discord.js";
import { PermissionFlagsBits, ChannelType } from "discord.js";
import type { TicketDatabase, Ticket } from "@database";
import type { Logger } from "@shared/Logger";
import type { GuildResourceLocator } from "@utilities";
import { EmbedFactory, CreateChannelManager } from "@utilities";

export interface TicketManagerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly ticketDb: TicketDatabase;
  readonly guildResourceLocator: GuildResourceLocator;
  readonly ticketCategoryId?: string | null;
  readonly staffRoleIds?: string[];
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
      prior.user_id,
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
    member: GuildMember,
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

  async GetTicketFromChannel(channelId: string): Promise<Ticket | null> {
    return this.options.ticketDb.GetTicketByChannel(channelId);
  }

  async ClaimTicket(ticketId: number, staffId: string): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket || ticket.status === "closed") {
      return false;
    }

    return this.options.ticketDb.UpdateTicketStatus(
      ticketId,
      "claimed",
      staffId,
    );
  }

  async CloseTicket(
    ticketId: number,
    closerId?: string,
    sendMessageBeforeDelete?: boolean,
    reason?: string | null,
  ): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket) {
      return false;
    }

    let channel: TextChannel | null = null;

    if (ticket.channel_id) {
      try {
        const fetchedChannel = await this.options.guild.channels.fetch(
          ticket.channel_id,
        );
        if (fetchedChannel && fetchedChannel.isTextBased()) {
          channel = fetchedChannel as TextChannel;
        }
      } catch (error) {
        this.options.logger.Error(
          "Failed to fetch ticket channel for closing",
          { error },
        );
      }
    }

    const updated = this.options.ticketDb.CloseTicket(ticketId, closerId, reason);

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
      const ticketChannel = channel;
      setTimeout(async () => {
        try {
          await ticketChannel.delete("Ticket closed (auto-delete)");
        } catch (error) {
          this.options.logger.Error("Failed to delete ticket channel", {
            error,
            extra: { ticketId, channelId: ticketChannel.id },
          });
        }
      }, 10000);
    }

    return updated;
  }

  async GetUserTickets(
    userId: string,
    guildId: string,
    status?: string,
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

  async AddUserToTicket(
    ticketId: number,
    userId: string,
    addedBy: string,
  ): Promise<boolean> {
    const ticket = this.options.ticketDb.GetTicket(ticketId);
    if (!ticket || !ticket.channel_id) {
      return false;
    }

    try {
      const channel = await this.options.guild.channels.fetch(
        ticket.channel_id,
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
    removedBy: string,
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
        ticket.channel_id,
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

      return this.options.ticketDb.RemoveParticipant(
        ticketId,
        userId,
        removedBy,
      );
    } catch (error) {
      this.options.logger.Error("Failed to remove user from ticket", {
        error,
        extra: { ticketId, userId, removedBy },
      });
      return false;
    }
  }

  private async ResolveTicketCategory(): Promise<CategoryChannel | null> {
    if (this.options.ticketCategoryId) {
      const existing =
        await this.options.guildResourceLocator.GetCategoryChannel(
          this.options.ticketCategoryId,
        );
      if (existing) {
        return existing;
      }
    }

    return await this.channelManager.GetOrCreateCategory("Support Tickets");
  }
}

export function CreateTicketManager(
  options: TicketManagerOptions,
): TicketManager {
  return new TicketManager(options);
}
