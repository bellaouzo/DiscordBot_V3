export * from "./TicketDatabase";
export { TICKET_CATEGORIES } from "./TicketDatabase";
export * from "./UserDatabase";
export * from "./ModerationDatabase";
export * from "./ServerDatabase";

import type { TicketDatabase } from "./TicketDatabase";
import type { UserDatabase } from "./UserDatabase";
import type { ModerationDatabase } from "./ModerationDatabase";
import type { ServerDatabase } from "./ServerDatabase";

export interface DatabaseSet {
  readonly userDb: UserDatabase;
  readonly moderationDb: ModerationDatabase;
  readonly serverDb: ServerDatabase;
  readonly ticketDb: TicketDatabase;
}
