import { Events, Message, TextChannel } from "discord.js";
import { CreateEvent, EventContext } from "@events/EventFactory";
import { EmbedFactory } from "@utilities";

async function ExecuteMessageCreateEvent(
  context: EventContext,
  msg: Message
): Promise<void> {
  if (!msg.guild || !msg.channel.isTextBased() || msg.author.bot) {
    return;
  }

  try {
    const filters = context.databases.moderationDb.ListLinkFilters(
      msg.guild.id
    );
    const allow = filters
      .filter((f) => f.type === "allow")
      .map((f) => f.pattern);
    const block = filters
      .filter((f) => f.type === "block")
      .map((f) => f.pattern);
    const content = (msg.content ?? "").toLowerCase();

    const isAllowed = allow.some((pattern) => content.includes(pattern));
    const isBlocked =
      !isAllowed && block.some((pattern) => content.includes(pattern));

    if (isBlocked) {
      try {
        await msg.delete();
      } catch (error) {
        context.logger.Error("Failed to delete blocked message", { error });
      }

      try {
        const notice = EmbedFactory.CreateWarning({
          title: "Link Blocked",
          description: "Your message contained a blocked link and was removed.",
        });
        await (msg.channel as TextChannel).send({
          content: `<@${msg.author.id}>`,
          embeds: [notice.toJSON()],
        });
      } catch (error) {
        context.logger.Error("Failed to send link block notice", { error });
      }

      return;
    }

    const ticket = context.databases.ticketDb.GetTicketByChannel(
      msg.channel.id
    );
    if (!ticket) {
      return;
    }

    const messageContent = msg.content || "[Embed or Attachment]";
    context.databases.ticketDb.AddMessage(
      ticket.id,
      msg.author.id,
      messageContent
    );
  } catch (error) {
    context.logger.Error("Failed to process message", { error });
  }
}

export const MessageCreateEvent = CreateEvent({
  name: Events.MessageCreate,
  once: false,
  execute: ExecuteMessageCreateEvent,
});
