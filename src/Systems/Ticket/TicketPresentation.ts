import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { TicketDatabase, Ticket } from "@database";
import { Logger } from "@shared/Logger";
import { EmbedFactory, ComponentFactory } from "@utilities";

export interface TicketPresentationOptions {
  readonly guild: Guild;
  readonly ticketDb: TicketDatabase;
  readonly logger: Logger;
}

export class TicketPresentation {
  constructor(private readonly options: TicketPresentationOptions) {}

  CreateTicketEmbed(ticket: Ticket): EmbedBuilder {
    const categories = this.options.ticketDb.EnsureCategoryConfigs(
      this.options.guild.id,
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
        ticket.channel_id,
      );
      if (!fetchedChannel || !fetchedChannel.isTextBased()) {
        return;
      }

      const channel = fetchedChannel as TextChannel;
      const messages = await channel.messages.fetch({ limit: 10 });
      const ticketMessage = messages.find((message) =>
        message.embeds.some((embed) =>
          embed.title?.includes(`Ticket #${ticket.id}`),
        ),
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
}

export function CreateTicketPresentation(
  options: TicketPresentationOptions,
): TicketPresentation {
  return new TicketPresentation(options);
}
