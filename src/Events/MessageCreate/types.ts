import type { Message } from "discord.js";
import type { EventContext } from "@events/EventFactory";

export type MessageCreateResult = "continue" | "stop";

export interface MessageCreateHandler {
  readonly name: string;
  readonly execute: (
    context: EventContext,
    msg: Message,
  ) => Promise<MessageCreateResult>;
}
