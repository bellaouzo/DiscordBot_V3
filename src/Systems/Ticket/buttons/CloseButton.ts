import {
  ButtonInteraction, Guild, GuildMember,
  MessageFlags
} from "discord.js";
import { ButtonResponder } from "@responders";
import { DatabaseSet } from "@database";
import { Logger } from "@shared/Logger";
import {
  EmbedFactory,
  CreateTicketManager,
  TranscriptGenerator,
} from "@utilities";
import {
  CanUserCloseTicket,
  CreateTicketServices,
  ParseTicketButtonCustomId,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleCloseButton(
  buttonInteraction: ButtonInteraction,
  options: {
    buttonResponder: ButtonResponder;
    databases: DatabaseSet;
    logger: Logger;
    guild: Guild;
  }
): Promise<void> {
  const parsed = ParseTicketButtonCustomId(buttonInteraction.customId);
  if (!parsed || parsed.action !== "close") {
    return;
  }

  const ticket = options.databases.ticketDb.GetTicket(parsed.ticketId);
  if (!ticket || ticket.status === "closed") {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Ticket Unavailable",
          description: "This ticket is already closed.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = options.databases.serverDb.GetGuildSettings(
    options.guild.id
  );
  const member = buttonInteraction.member as GuildMember | null;

  if (
    !CanUserCloseTicket(ticket, buttonInteraction.user.id, member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Permission Denied",
          description: "Only the ticket owner or staff can close this ticket.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await options.buttonResponder.DeferUpdate(buttonInteraction);

  const closeEmbed = EmbedFactory.CreateTicketClosed(
    ticket.id,
    buttonInteraction.user.id
  );
  await options.buttonResponder.EditMessage(buttonInteraction, {
    embeds: [closeEmbed.toJSON()],
    components: [],
  });

  const { ticketManager, guildResourceLocator } = CreateTicketServices(
    options.logger,
    options.guild,
    options.databases.ticketDb,
    options.databases.serverDb
  );

  const messages = options.databases.ticketDb.GetTicketMessages(ticket.id);
  const ticketMember = await guildResourceLocator.GetMember(ticket.user_id);
  const user =
    ticketMember?.user ||
    (await buttonInteraction.client.users.fetch(ticket.user_id));
  const participantHistory =
    options.databases.ticketDb.GetParticipantHistory(ticket.id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: options.guild,
    participantHistory,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  await SendTicketLogs(
    ticketManager,
    transcript,
    filename,
    `Ticket #${ticket.id} closed by <@${buttonInteraction.user.id}>`,
    options.logger
  );

  await ticketManager.CloseTicket(ticket.id, buttonInteraction.user.id, false);
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
