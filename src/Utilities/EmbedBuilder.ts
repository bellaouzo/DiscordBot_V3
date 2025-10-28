import { EmbedBuilder, ColorResolvable } from "discord.js";

export interface EmbedOptions {
  readonly title?: string;
  readonly description?: string;
  readonly color?: ColorResolvable;
  readonly footer?: string;
  readonly timestamp?: boolean;
  readonly thumbnail?: string;
  readonly image?: string;
}

export interface FieldOptions {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

export class EmbedFactory {
  private static readonly DEFAULT_COLOR = 0x5865f2;
  private static readonly SUCCESS_COLOR = 0x57f287;
  private static readonly WARNING_COLOR = 0xfee75c;
  private static readonly ERROR_COLOR = 0xed4245;

  static Create(options: EmbedOptions = {}): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);

    embed.setColor(options.color ?? this.DEFAULT_COLOR);

    if (options.timestamp !== false) embed.setTimestamp();
    if (options.footer) embed.setFooter({ text: options.footer });

    return embed;
  }

  static CreateSuccess(options: Omit<EmbedOptions, "color">): EmbedBuilder {
    return this.Create({ ...options, color: this.SUCCESS_COLOR });
  }

  static CreateWarning(options: Omit<EmbedOptions, "color">): EmbedBuilder {
    return this.Create({ ...options, color: this.WARNING_COLOR });
  }

  static CreateError(options: Omit<EmbedOptions, "color">): EmbedBuilder {
    return this.Create({ ...options, color: this.ERROR_COLOR });
  }

  static CreateHelpSection(
    sectionName: string,
    description: string,
    commandCount: number
  ): EmbedBuilder {
    return this.Create({
      title: `📁 ${sectionName} Commands`,
      description,
      footer: `${commandCount} command${
        commandCount !== 1 ? "s" : ""
      } available`,
      color: this.GetSectionColor(sectionName),
    });
  }

  static CreateHelpOverview(
    totalCommands: number,
    categoryCount: number
  ): EmbedBuilder {
    return this.Create({
      title: "🤖 Bot Command Overview",
      description:
        "Welcome to the help menu! Use the buttons below to navigate between different command categories.",
      footer: `Total: ${totalCommands} commands across ${categoryCount} categories`,
      color: this.DEFAULT_COLOR,
    });
  }

  static CreateTicketList(
    tickets: Array<{
      id: number;
      category: string;
      status: string;
      created_at: number;
    }>
  ): EmbedBuilder {
    const embed = this.Create({
      title: "🎫 Your Tickets",
      description:
        tickets.length === 0
          ? "You have no tickets. Use `/ticket create` to open a new ticket."
          : `You have **${tickets.length}** ticket${
              tickets.length !== 1 ? "s" : ""
            }`,
      color: this.DEFAULT_COLOR,
    });

    if (tickets.length > 0) {
      const ticketList = tickets
        .slice(0, 10)
        .map((ticket) => {
          const statusEmoji =
            ticket.status === "closed"
              ? "🔒"
              : ticket.status === "claimed"
              ? "📌"
              : "📝";
          const date = new Date(ticket.created_at).toLocaleDateString();
          return `${statusEmoji} **Ticket #${ticket.id}** - ${ticket.category} (${ticket.status}) - ${date}`;
        })
        .join("\n");

      embed.addFields({
        name: "Active Tickets",
        value: ticketList,
        inline: false,
      });
    }

    return embed;
  }

  static CreateTicketClosed(ticketId: number, closedBy: string): EmbedBuilder {
    return this.CreateWarning({
      title: "🔒 Ticket Closed",
      description: `Ticket #${ticketId} has been closed by <@${closedBy}>.`,
      footer: "This channel will be deleted soon.",
    });
  }

  static CreateTicketClaimed(
    ticketId: number,
    claimedBy: string
  ): EmbedBuilder {
    return this.CreateSuccess({
      title: "📌 Ticket Claimed",
      description: `Ticket #${ticketId} has been claimed by <@${claimedBy}>.`,
      footer: "Staff will now assist you.",
    });
  }

  private static GetSectionColor(sectionName: string): ColorResolvable {
    const colors: Record<string, ColorResolvable> = {
      Utility: 0x5865f2,
      Moderation: 0xed4245,
      Admin: 0xfee75c,
      Fun: 0x57f287,
      Info: 0xeb459e,
      Music: 0x1abc9c,
      Economy: 0xffd700,
      Games: 0x9b59b6,
    };
    return colors[sectionName] ?? this.DEFAULT_COLOR;
  }
}
