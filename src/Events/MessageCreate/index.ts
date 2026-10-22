export type { MessageCreateHandler, MessageCreateResult } from "./types";
export { LinkFilterHandler } from "./LinkFilterHandler";
export { ChatXpHandler } from "./ChatXpHandler";
export { TicketMessageHandler } from "./TicketMessageHandler";
export { SpamFilterHandler } from "./SpamFilterHandler";
export { TagTriggerHandler } from "./TagTriggerHandler";
export {
  ProtectedChannelGuardHandler,
  VerificationChannelGuardHandler,
} from "./ProtectedChannelGuardHandler";
export { RunMessageCreateHandlers } from "./RunMessageCreateHandlers";

import { ChatXpHandler } from "./ChatXpHandler";
import { LinkFilterHandler } from "./LinkFilterHandler";
import { TicketMessageHandler } from "./TicketMessageHandler";
import { ProtectedChannelGuardHandler } from "./ProtectedChannelGuardHandler";
import { SpamFilterHandler } from "./SpamFilterHandler";
import { TagTriggerHandler } from "./TagTriggerHandler";
import type { MessageCreateHandler } from "./types";

export const MESSAGE_CREATE_HANDLERS: readonly MessageCreateHandler[] = [
  ProtectedChannelGuardHandler,
  SpamFilterHandler,
  LinkFilterHandler,
  TagTriggerHandler,
  ChatXpHandler,
  TicketMessageHandler,
];
