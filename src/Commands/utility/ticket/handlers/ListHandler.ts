import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import { CreateTicketServices } from "@commands/utility/ticket/validation/TicketValidation";
import {
  RegisterTicketListButtons,
  CreateTicketListPage,
} from "@commands/utility/ticket/components/TicketListPagination";

export async function HandleTicketList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const { logger } = context;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
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
    return;
  }

  if (totalPages === 1) {
    const embed = EmbedFactory.CreateTicketList(tickets);
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
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
    embeds: firstPage.embeds,
    components: firstPage.components,
    ephemeral: true,
  });
}
