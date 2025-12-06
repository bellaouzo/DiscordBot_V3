import { ButtonInteraction } from "discord.js";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { TicketDatabase, Ticket } from "../../../../Database";
import { EmbedFactory } from "../../../../Utilities";
import { HasStaffPermissions } from "../validation/TicketValidation";
import { BUTTON_EXPIRATION_MS } from "../types/TicketTypes";

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
