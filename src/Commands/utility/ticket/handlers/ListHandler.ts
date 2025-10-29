import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { EmbedFactory } from "../../../../Utilities";
import { CreateTicketServices } from "../validation/TicketValidation";
import { RegisterTicketListButtons, CreateTicketListPage } from "../components/TicketListPagination";

export async function HandleTicketList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const { logger } = context;

  if (!interaction.guild) {
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const { ticketDb } = CreateTicketServices(logger, interaction.guild);
  const tickets = ticketDb.GetUserTickets(
    interaction.user.id,
    interaction.guild.id
  );

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));

  if (tickets.length === 0) {
    const embed = EmbedFactory.CreateTicketList(tickets);
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    logger.Info("Ticket list viewed", {
      extra: { userId: interaction.user.id, ticketCount: 0 },
    });
    return;
  }

  if (totalPages === 1) {
    const embed = EmbedFactory.CreateTicketList(tickets);
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    logger.Info("Ticket list viewed", {
      extra: { userId: interaction.user.id, ticketCount: tickets.length },
    });
    return;
  }

  RegisterTicketListButtons(
    componentRouter,
    buttonResponder,
    tickets,
    interaction.user.id,
    totalPages
  );

  const firstPage = CreateTicketListPage(tickets, 0, pageSize, totalPages);
  await interactionResponder.Reply(interaction, {
    content: firstPage.content,
    embeds: firstPage.embeds,
    components: firstPage.components,
    ephemeral: true,
  });

  logger.Info("Ticket list viewed", {
    extra: {
      userId: interaction.user.id,
      ticketCount: tickets.length,
      totalPages,
    },
  });
}
