import { ButtonInteraction } from "discord.js";
import { ComponentRouter } from "@shared/ComponentRouter";
import { ButtonResponder } from "@responders";
import { TicketDatabase, Ticket } from "@database";
import { EmbedFactory } from "@utilities";
import { HasStaffPermissions } from "@systems/Ticket/validation/TicketValidation";
import { BUTTON_EXPIRATION_MS } from "@systems/Ticket/types/TicketTypes";

export async function RegisterClaimButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  interactionId: string,
  ticketDb: TicketDatabase
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:claim:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);
      if (!HasStaffPermissions(buttonInteraction.member)) {
        return;
      }

      ticketDb.UpdateTicketStatus(
        ticket.id,
        "claimed",
        buttonInteraction.user.id
      );

      const claimEmbed = EmbedFactory.CreateTicketClaimed(
        ticket.id,
        buttonInteraction.user.id
      );
      await buttonResponder.EditMessage(buttonInteraction, {
        embeds: [claimEmbed.toJSON()],
        components: [],
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}


