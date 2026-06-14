import type { MessageCreateHandler } from "./types";

export const TicketMessageHandler: MessageCreateHandler = {
  name: "ticket-message",

  async execute(context, msg) {
    const ticket = context.databases.ticketDb.GetTicketByChannel(msg.channel.id);
    if (!ticket) {
      return "continue";
    }

    const messageContent = msg.content || "[Embed or Attachment]";
    context.databases.ticketDb.AddMessage(
      ticket.id,
      msg.author.id,
      messageContent,
    );

    return "continue";
  },
};
