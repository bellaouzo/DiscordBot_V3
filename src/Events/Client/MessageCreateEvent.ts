import { Events, Message } from "discord.js";
import { CreateEvent, EventContext } from "../../Events/EventFactory";
import { TicketDatabase } from "../../Database";

async function ExecuteMessageCreateEvent(
  context: EventContext,
  message: unknown,
): Promise<void> {
  const msg = message as Message;
  if (!msg.guild || !msg.channel.isTextBased() || msg.author.bot) {
    return;
  }

  try {
    const ticketDb = new TicketDatabase(context.logger);
    const ticket = ticketDb.GetTicketByChannel(msg.channel.id);

    if (!ticket) {
      return;
    }

    const content = msg.content || "[Embed or Attachment]";
    ticketDb.AddMessage(ticket.id, msg.author.id, content);

    context.logger.Debug("Ticket message logged", {
      extra: {
        ticketId: ticket.id,
        channelId: msg.channel.id,
        userId: msg.author.id,
      },
    });
  } catch (error) {
    context.logger.Error("Failed to log ticket message", { error });
  }
}

export const MessageCreateEvent = CreateEvent({
  name: Events.MessageCreate,
  once: false,
  execute: ExecuteMessageCreateEvent,
});
