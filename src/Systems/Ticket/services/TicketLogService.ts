import {
  Guild,
  TextChannel,
  PermissionFlagsBits,
  OverwriteResolvable,
  ChannelType,
} from "discord.js";
import { Logger } from "@shared/Logger";

export interface TicketLogServiceOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly staffRoleIds?: string[];
  readonly ticketLogChannelId?: string | null;
}

export class TicketLogService {
  constructor(private readonly options: TicketLogServiceOptions) {}

  async GetOrCreateTicketLogsChannel(): Promise<TextChannel | null> {
    try {
      if (this.options.ticketLogChannelId) {
        const configured = await this.options.guild.channels.fetch(
          this.options.ticketLogChannelId,
        );
        if (configured?.isTextBased()) {
          return configured as TextChannel;
        }
      }

      const cachedChannel = this.options.guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.name.toLowerCase() === "ticket-logs",
      );

      if (cachedChannel) {
        return cachedChannel as TextChannel;
      }

      const fetchedChannels = await this.options.guild.channels.fetch();
      const existingChannel = fetchedChannels.find(
        (channel) =>
          channel &&
          channel.type === ChannelType.GuildText &&
          channel.name.toLowerCase() === "ticket-logs",
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
}

export function CreateTicketLogService(
  options: TicketLogServiceOptions,
): TicketLogService {
  return new TicketLogService(options);
}
