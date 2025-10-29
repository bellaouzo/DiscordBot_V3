import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { EmbedFactory } from "../../../../Utilities";
import { CreateTicketManager } from "../../../../Utilities/TicketManager";
import { TranscriptGenerator } from "../../../../Utilities/TranscriptGenerator";
import { CreateTicketServices, ValidateTicketChannelOrReply, GetTicketOrReply } from "../validation/TicketValidation";

export async function HandleTicketClose(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

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

  const embed = EmbedFactory.CreateTicketClosed(ticket.id, interaction.user.id);

  if ("send" in interaction.channel!) {
    await (interaction.channel as TextChannel).send({
      embeds: [embed.toJSON()],
    });
  }

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

  await SendTicketLogs(
    ticketManager,
    transcript,
    filename,
    `Ticket #${ticket.id} closed by <@${interaction.user.id}>`,
    logger
  );

  await interactionResponder.Reply(interaction, {
    content: "Ticket closed successfully.",
  });

  const success = await ticketManager.CloseTicket(
    ticket.id,
    interaction.user.id,
    false
  );

  if (success) {
    logger.Info("Ticket closed", {
      extra: { ticketId: ticket.id, closedBy: interaction.user.id },
    });
  } else {
    logger.Error("Failed to close ticket", {
      extra: { ticketId: ticket.id, closedBy: interaction.user.id },
    });
  }
}

async function SendTicketLogs(
  ticketManager: ReturnType<typeof CreateTicketManager>,
  transcript: string,
  filename: string,
  message: string,
  logger: any
): Promise<void> {
  try {
    const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();
    if (logsChannel) {
      await logsChannel.send({
        content: message,
        files: [
          { name: filename, attachment: Buffer.from(transcript, "utf-8") },
        ],
      });
      logger.Info("Ticket logs sent successfully", {
        extra: { logsChannelId: logsChannel.id },
      });
    } else {
      logger.Error("Failed to get or create logs channel", {
        extra: { guildId: ticketManager },
      });
    }
  } catch (error) {
    logger.Error("Failed to send ticket logs", { error });
  }
}
