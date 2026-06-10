import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import { CreateTicketServices } from "@systems/Ticket/validation/TicketValidation";
import {
  RegisterTicketListButtons,
  CreateTicketListPage,
} from "@systems/Ticket/components/TicketListPagination";
import { HandleTicketQueue } from "@systems/Ticket/handlers/QueueHandler";

export async function HandleTicketList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const scope = interaction.options.getString("scope") ?? "mine";

  if (scope === "server") {
    await HandleTicketQueue(interaction, context);
    return;
  }

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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { ticketDb } = CreateTicketServices(
    logger,
    interaction.guild,
    context.databases.ticketDb,
    context.databases.serverDb,
  );
  const tickets = ticketDb.GetUserTickets(
    interaction.user.id,
    interaction.guild.id,
  );
  const tagMap = ticketDb.GetTagsForTickets(tickets.map((t) => t.id));
  const ticketsWithTags = tickets.map((ticket) => ({
    ...ticket,
    channel_id: ticket.channel_id,
    tags: tagMap[ticket.id] ?? [],
  }));

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));

  if (tickets.length === 0) {
    const embed = EmbedFactory.CreateTicketList(ticketsWithTags);
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (totalPages === 1) {
    const embed = EmbedFactory.CreateTicketList(ticketsWithTags);
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  RegisterTicketListButtons(
    componentRouter,
    buttonResponder,
    ticketsWithTags,
    interaction.user.id,
    totalPages,
  );

  const firstPage = CreateTicketListPage(
    ticketsWithTags,
    0,
    pageSize,
    totalPages,
  );
  await interactionResponder.Reply(interaction, {
    embeds: firstPage.embeds,
    components: firstPage.components,
    flags: MessageFlags.Ephemeral,
  });
}
