import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { TranscriptGenerator } from "../../../../Utilities/TranscriptGenerator";
import { CreateTicketServices, ValidateTicketChannelOrReply, GetTicketOrReply, HasStaffPermissions } from "../validation/TicketValidation";

export async function HandleTicketTranscript(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  if (!HasStaffPermissions(interaction.member)) {
    await interactionResponder.Reply(interaction, {
      content: "You need staff permissions to generate transcripts.",
      ephemeral: true,
    });
    return;
  }

  const { ticketDb, ticketManager } = CreateTicketServices(
    logger,
    interaction.guild!
  );
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

  const messages = ticketDb.GetTicketMessages(ticket.id);
  const user = await interaction.client.users.fetch(ticket.user_id);
  const participantHistory = ticketDb.GetParticipantHistory(ticket.id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: interaction.guild!,
    participantHistory,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();

  if (logsChannel) {
    await logsChannel.send({
      content: `Transcript for Ticket #${ticket.id}`,
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
    });

    await interactionResponder.Reply(interaction, {
      content: "Transcript generated and sent to ticket-logs channel.",
      ephemeral: true,
    });
  } else {
    await interactionResponder.Reply(interaction, {
      content: "Generated ticket transcript:",
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
      ephemeral: true,
    });
  }

  logger.Info("Ticket transcript generated", {
    extra: { ticketId: ticket.id, generatedBy: interaction.user.id },
  });
}
