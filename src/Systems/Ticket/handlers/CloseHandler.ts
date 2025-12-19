import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  EmbedFactory,
  CreateTicketManager,
  TranscriptGenerator,
} from "@utilities";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
} from "@systems/Ticket/validation/TicketValidation";
import { Logger } from "@shared/Logger";

export async function HandleTicketClose(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(logger, interaction.guild!, context.databases.ticketDb);
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

  const embed = EmbedFactory.CreateTicketClosed(ticket.id, interaction.user.id);

  if ("send" in interaction.channel!) {
    await (interaction.channel as TextChannel).send({
      embeds: [embed.toJSON()],
    });
  }

  const messages = ticketDb.GetTicketMessages(ticket.id);
  const member = await guildResourceLocator.GetMember(ticket.user_id);
  const user =
    member?.user || (await interaction.client.users.fetch(ticket.user_id));
  const participantHistory = ticketDb.GetParticipantHistory(ticket.id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: interaction.guild!,
    participantHistory,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  await SendTicketLogs(
    ticketManager,
    transcript,
    filename,
    `Ticket #${ticket.id} closed by <@${interaction.user.id}>`,
    logger
  );

  const replyEmbed = EmbedFactory.CreateSuccess({
    title: "Ticket Closed",
    description: "Ticket closed successfully.",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [replyEmbed.toJSON()],
  });

  await ticketManager.CloseTicket(ticket.id, interaction.user.id, false);
}

async function SendTicketLogs(
  ticketManager: ReturnType<typeof CreateTicketManager>,
  transcript: string,
  filename: string,
  message: string,
  logger: Logger
): Promise<void> {
  try {
    const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();
    if (logsChannel) {
      const embed = EmbedFactory.CreateSuccess({
        title: "Ticket Closed",
        description: message,
      });
      await logsChannel.send({
        embeds: [embed.toJSON()],
        files: [
          { name: filename, attachment: Buffer.from(transcript, "utf-8") },
        ],
      });
    }
  } catch (error) {
    logger.Error("Failed to send ticket logs", { error });
  }
}



