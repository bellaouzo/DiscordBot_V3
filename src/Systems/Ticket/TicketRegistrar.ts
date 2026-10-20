import { DefineSystemRegistrar } from "@shared/SystemRegistrar";
import { RegisterTicketButtons } from "@systems/Ticket/TicketButtonRegistry";
import { RegisterTicketPanelButton } from "@systems/Ticket/TicketPanelFlow";

export const TicketRegistrar = DefineSystemRegistrar("tickets", (context) => {
  RegisterTicketButtons(context);
  RegisterTicketPanelButton(context);
});
