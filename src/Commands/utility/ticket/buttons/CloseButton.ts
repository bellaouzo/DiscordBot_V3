import { ButtonInteraction, Guild } from "discord.js";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { TicketDatabase, Ticket } from "../../../../Database";
import { Logger } from "../../../../Shared/Logger";
import {
  EmbedFactory,
  CreateTicketManager,
  TranscriptGenerator,
  GuildResourceLocator,
} from "../../../../Utilities";
import { BUTTON_EXPIRATION_MS } from "../types/TicketTypes";

export async function RegisterCloseButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  interactionId: string,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild,
  guildResourceLocator: GuildResourceLocator
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:close:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);

      const closeEmbed = EmbedFactory.CreateTicketClosed(
        ticket.id,
        buttonInteraction.user.id
      );
      await buttonResponder.EditMessage(buttonInteraction, {
        embeds: [closeEmbed.toJSON()],
        components: [],
      });

      const ticketManager = CreateTicketManager({
        guild,
        logger,
        ticketDb,
        guildResourceLocator,
      });

      const messages = ticketDb.GetTicketMessages(ticket.id);
      const member = await guildResourceLocator.GetMember(ticket.user_id);
      const user =
        member?.user ||
        (await buttonInteraction.client.users.fetch(ticket.user_id));
      const participantHistory = ticketDb.GetParticipantHistory(ticket.id);

      const transcript = TranscriptGenerator.Generate({
        ticket,
        messages,
        user,
        guild,
        participantHistory,
      });

      const filename = TranscriptGenerator.GenerateFileName(ticket);

      await SendTicketLogs(
        ticketManager,
        transcript,
        filename,
        `Ticket #${ticket.id} closed by <@${buttonInteraction.user.id}>`,
        logger
      );

      await ticketManager.CloseTicket(
        ticket.id,
        buttonInteraction.user.id,
        false
      );
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
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
      await logsChannel.send({
        content: message,
        files: [
          { name: filename, attachment: Buffer.from(transcript, "utf-8") },
        ],
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
