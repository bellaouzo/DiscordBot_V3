export type { MessageCreateHandler, MessageCreateResult } from "./types";
export { LinkFilterHandler } from "./LinkFilterHandler";
export { ChatXpHandler } from "./ChatXpHandler";
export { TicketMessageHandler } from "./TicketMessageHandler";
export { RunMessageCreateHandlers } from "./RunMessageCreateHandlers";

import { ChatXpHandler } from "./ChatXpHandler";
import { LinkFilterHandler } from "./LinkFilterHandler";
import { TicketMessageHandler } from "./TicketMessageHandler";
import type { MessageCreateHandler } from "./types";

export const MESSAGE_CREATE_HANDLERS: readonly MessageCreateHandler[] = [
  LinkFilterHandler,
  ChatXpHandler,
  TicketMessageHandler,
];
