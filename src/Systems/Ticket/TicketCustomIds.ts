import { DefineCustomId } from "@shared/CustomId";

/** Persistent buttons on every ticket's control message. */
export const TicketButtonIds = {
  claim: DefineCustomId("ticket:claim", { ticketId: "int" }),
  add: DefineCustomId("ticket:add", { ticketId: "int" }),
  remove: DefineCustomId("ticket:remove", { ticketId: "int" }),
  close: DefineCustomId("ticket:close", { ticketId: "int" }),
} as const;
