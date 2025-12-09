export * from "./TicketDatabase";
export { TICKET_CATEGORIES } from "./TicketDatabase";
export * from "./UserDatabase";
export * from "./ModerationDatabase";
export * from "./ServerDatabase";

import { TicketDatabase } from "./TicketDatabase";
import { UserDatabase } from "./UserDatabase";
import { ModerationDatabase } from "./ModerationDatabase";
import { ServerDatabase } from "./ServerDatabase";

export interface DatabaseSet {
  readonly userDb: UserDatabase;
  readonly moderationDb: ModerationDatabase;
  readonly serverDb: ServerDatabase;
  readonly ticketDb: TicketDatabase;
}
