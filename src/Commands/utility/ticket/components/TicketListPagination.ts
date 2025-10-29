import { ButtonInteraction, ButtonStyle, ActionRowData, ActionRowComponentData } from "discord.js";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { EmbedFactory, ComponentFactory } from "../../../../Utilities";
import { TicketInfo, TicketListPage } from "../types/TicketTypes";

export function CreateTicketListPage(
  tickets: TicketInfo[],
  pageIndex: number,
  pageSize: number,
  totalPages: number
): TicketListPage {
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const pageTickets = tickets.slice(start, end);

  const embed = EmbedFactory.Create({
    title: "🎫 Your Tickets",
    description: `You have **${tickets.length}** ticket${
      tickets.length !== 1 ? "s" : ""
    }`,
    color: 0x5865f2,
  });

  if (pageTickets.length > 0) {
    const ticketList = pageTickets
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
      name: `Page ${pageIndex + 1}/${totalPages}`,
      value: ticketList,
      inline: false,
    });
  }

  return {
    content: "",
    embeds: [embed.toJSON()],
    components: [BuildPaginationRow(pageIndex, totalPages)],
  };
}

function BuildPaginationRow(
  pageIndex: number,
  totalPages: number
): ActionRowData<ActionRowComponentData> {
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === totalPages - 1;

  const buttons = [
    {
      label: "⏮",
      style: ButtonStyle.Secondary,
      disabled: isFirst,
      customId: `ticket-list:first:${pageIndex}`,
    },
    {
      label: "◀",
      style: ButtonStyle.Secondary,
      disabled: isFirst,
      customId: `ticket-list:prev:${pageIndex}`,
    },
    {
      label: "▶",
      style: ButtonStyle.Secondary,
      disabled: isLast,
      customId: `ticket-list:next:${pageIndex}`,
    },
    {
      label: "⏭",
      style: ButtonStyle.Secondary,
      disabled: isLast,
      customId: `ticket-list:last:${pageIndex}`,
    },
  ];

  return ComponentFactory.CreateActionRow({
    buttons: buttons.map((button) => ({
      label: button.label,
      style: button.style,
      disabled: button.disabled,
    })),
    customIds: buttons.map((button) => button.customId),
  }).toJSON() as ActionRowData<ActionRowComponentData>;
}

export function RegisterTicketListButtons(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  tickets: TicketInfo[],
  ownerId: string,
  totalPages: number
): void {
  const pageSize = 10;

  for (let i = 0; i < totalPages; i++) {
    componentRouter.RegisterButton({
      customId: `ticket-list:first:${i}`,
      ownerId,
      handler: async (buttonInteraction: ButtonInteraction) => {
        await ShowTicketListPage({
          buttonInteraction,
          buttonResponder,
          tickets,
          pageIndex: 0,
          pageSize,
          totalPages,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: `ticket-list:prev:${i}`,
      ownerId,
      handler: async (buttonInteraction: ButtonInteraction) => {
        const parsed = ParseTicketListPageNavCustomId(
          buttonInteraction.customId
        );
        if (!parsed) {
          return;
        }

        await ShowTicketListPage({
          buttonInteraction,
          buttonResponder,
          tickets,
          pageIndex: Math.max(parsed.pageIndex - 1, 0),
          pageSize,
          totalPages,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: `ticket-list:next:${i}`,
      ownerId,
      handler: async (buttonInteraction: ButtonInteraction) => {
        const parsed = ParseTicketListPageNavCustomId(
          buttonInteraction.customId
        );
        if (!parsed) {
          return;
        }

        await ShowTicketListPage({
          buttonInteraction,
          buttonResponder,
          tickets,
          pageIndex: Math.min(parsed.pageIndex + 1, totalPages - 1),
          pageSize,
          totalPages,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: `ticket-list:last:${i}`,
      ownerId,
      handler: async (buttonInteraction: ButtonInteraction) => {
        await ShowTicketListPage({
          buttonInteraction,
          buttonResponder,
          tickets,
          pageIndex: totalPages - 1,
          pageSize,
          totalPages,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });
  }
}

async function ShowTicketListPage(options: {
  readonly buttonInteraction: ButtonInteraction;
  readonly buttonResponder: ButtonResponder;
  readonly tickets: TicketInfo[];
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly totalPages: number;
}): Promise<void> {
  const {
    buttonInteraction,
    buttonResponder,
    tickets,
    pageIndex,
    pageSize,
    totalPages,
  } = options;

  const clampedIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const page = CreateTicketListPage(
    tickets,
    clampedIndex,
    pageSize,
    totalPages
  );

  await buttonResponder.DeferUpdate(buttonInteraction);
  await buttonResponder.EditReply(buttonInteraction, {
    content: page.content,
    embeds: page.embeds,
    components: page.components,
  });
}

function ParseTicketListPageNavCustomId(customId: string): {
  action: "first" | "prev" | "next" | "last";
  pageIndex: number;
} | null {
  const match = customId.match(/^ticket-list:(first|prev|next|last):(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    action: match[1] as "first" | "prev" | "next" | "last",
    pageIndex: Number.parseInt(match[2], 10),
  };
}
