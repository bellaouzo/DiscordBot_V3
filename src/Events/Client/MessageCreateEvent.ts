import type { Message } from "discord.js";
import { Events } from "discord.js";
import type { EventContext } from "@events/EventFactory";
import { CreateEvent } from "@events/EventFactory";
import {
  MESSAGE_CREATE_HANDLERS,
  RunMessageCreateHandlers,
} from "@events/MessageCreate";

async function ExecuteMessageCreateEvent(
  context: EventContext,
  msg: Message,
): Promise<void> {
  if (!msg.guild || !msg.channel.isTextBased() || msg.author.bot) {
    return;
  }

  await RunMessageCreateHandlers(context, msg, MESSAGE_CREATE_HANDLERS);
}

export const MessageCreateEvent = CreateEvent({
  name: Events.MessageCreate,
  once: false,
  execute: ExecuteMessageCreateEvent,
});
