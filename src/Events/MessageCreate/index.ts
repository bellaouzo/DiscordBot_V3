export type { MessageCreateHandler, MessageCreateResult } from "./types";
export { LinkFilterHandler } from "./LinkFilterHandler";
export { ChatXpHandler } from "./ChatXpHandler";
export { TicketMessageHandler } from "./TicketMessageHandler";
export { VerificationChannelGuardHandler } from "./VerificationChannelGuardHandler";
export { RunMessageCreateHandlers } from "./RunMessageCreateHandlers";

import { ChatXpHandler } from "./ChatXpHandler";
import { LinkFilterHandler } from "./LinkFilterHandler";
import { TicketMessageHandler } from "./TicketMessageHandler";
import { VerificationChannelGuardHandler } from "./VerificationChannelGuardHandler";
import type { MessageCreateHandler } from "./types";

export const MESSAGE_CREATE_HANDLERS: readonly MessageCreateHandler[] = [
  VerificationChannelGuardHandler,
  LinkFilterHandler,
  ChatXpHandler,
  TicketMessageHandler,
];
