export type { MessageCreateHandler, MessageCreateResult } from "./types";
export { LinkFilterHandler } from "./LinkFilterHandler";
export { ChatXpHandler } from "./ChatXpHandler";
export { TicketMessageHandler } from "./TicketMessageHandler";
export {
  ProtectedChannelGuardHandler,
  VerificationChannelGuardHandler,
} from "./ProtectedChannelGuardHandler";
export { RunMessageCreateHandlers } from "./RunMessageCreateHandlers";

import { ChatXpHandler } from "./ChatXpHandler";
import { LinkFilterHandler } from "./LinkFilterHandler";
import { TicketMessageHandler } from "./TicketMessageHandler";
import { ProtectedChannelGuardHandler } from "./ProtectedChannelGuardHandler";
import type { MessageCreateHandler } from "./types";

export const MESSAGE_CREATE_HANDLERS: readonly MessageCreateHandler[] = [
  ProtectedChannelGuardHandler,
  LinkFilterHandler,
  ChatXpHandler,
  TicketMessageHandler,
];
