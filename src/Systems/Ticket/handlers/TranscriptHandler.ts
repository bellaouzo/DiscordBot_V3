import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  RequireGuild,
  EmbedFactory,
  TranscriptGenerator,
  ResolveInteractionMember,
} from "@utilities";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
  HasStaffPermissions,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketTranscript(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  const settings = context.databases.serverDb.GetGuildSettings(
    RequireGuild(interaction).id,
  );

  const member = await ResolveInteractionMember(interaction);

  if (
    !HasStaffPermissions(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Required",
      description: "You need staff permissions to generate transcripts.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { ticketDb, ticketLogService, guildResourceLocator } =
    CreateTicketServices(
      logger,
      RequireGuild(interaction),
      context.databases.ticketDb,
      context.databases.serverDb,
    );
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder,
  );

  if (!ticket) return;

  const messages = ticketDb.GetTicketMessages(ticket.id);
  const ticketOwner = await guildResourceLocator.GetMember(ticket.user_id);
  const user =
    ticketOwner?.user || (await interaction.client.users.fetch(ticket.user_id));
  const participantHistory = ticketDb.GetParticipantHistory(ticket.id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: RequireGuild(interaction),
    participantHistory,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  const logsChannel = await ticketLogService.GetOrCreateTicketLogsChannel();

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
      flags: MessageFlags.Ephemeral,
    });
  } else {
    const replyEmbed = EmbedFactory.CreateWarning({
      title: "Transcript Generated",
      description: "Generated ticket transcript:",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [replyEmbed.toJSON()],
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
      flags: MessageFlags.Ephemeral,
    });
  }
}
