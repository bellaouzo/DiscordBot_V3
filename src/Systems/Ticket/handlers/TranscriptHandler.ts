import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory, TranscriptGenerator } from "@utilities";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
  HasStaffPermissions,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketTranscript(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  if (!HasStaffPermissions(interaction.member)) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Required",
      description: "You need staff permissions to generate transcripts.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(logger, interaction.guild!, context.databases.ticketDb);
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

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

  const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();

  if (logsChannel) {
    const logEmbed = EmbedFactory.CreateSuccess({
      title: "Ticket Transcript",
      description: `Transcript for Ticket #${ticket.id}`,
    });
    await logsChannel.send({
      embeds: [logEmbed.toJSON()],
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
    });

    const replyEmbed = EmbedFactory.CreateSuccess({
      title: "Transcript Generated",
      description: "Transcript generated and sent to ticket-logs channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [replyEmbed.toJSON()],
      ephemeral: true,
    });
  } else {
    const replyEmbed = EmbedFactory.CreateWarning({
      title: "Transcript Generated",
      description: "Generated ticket transcript:",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [replyEmbed.toJSON()],
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
      ephemeral: true,
    });
  }
}



