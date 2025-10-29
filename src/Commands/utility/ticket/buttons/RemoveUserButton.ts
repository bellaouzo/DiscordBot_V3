import { ButtonInteraction, Guild } from "discord.js";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { TicketDatabase, Ticket } from "../../../../Database";
import { Logger } from "../../../../Shared/Logger";
import { ComponentFactory } from "../../../../Utilities";
import { CreateTicketManager } from "../../../../Utilities/TicketManager";
import { UserSelectMenuRouter } from "../../../../Shared/UserSelectMenuRouter";
import { BUTTON_EXPIRATION_MS } from "../types/TicketTypes";
import { HandleUserRemoval } from "../components/UserSelectionMenu";

export async function RegisterRemoveUserButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  interactionId: string,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild,
  userSelectMenuRouter: UserSelectMenuRouter
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:remove:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);

      const member = await guild.members.fetch(buttonInteraction.user.id);
      const ticketManager = CreateTicketManager({
        guild,
        logger,
        ticketDb,
      });

      if (
        !ticketManager.CanUserRemoveParticipants(
          ticket,
          buttonInteraction.user.id,
          member
        )
      ) {
        return;
      }

      // Get active participants (excluding ticket owner)
      const activeParticipants = ticketDb.GetActiveParticipants(ticket.id);
      const participantIds = activeParticipants
        .filter((p) => p.user_id !== ticket.user_id)
        .map((p) => p.user_id);

      if (participantIds.length === 0) {
        await buttonInteraction.followUp({
          content: "There are no users to remove from this ticket.",
          ephemeral: true,
        });
        return;
      }

      const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
        customId: `ticket-remove-button:${buttonInteraction.id}`,
        placeholder: "Select users to remove from this ticket...",
        minValues: 1,
        maxValues: Math.min(participantIds.length, 10),
      });

      userSelectMenuRouter.RegisterUserSelectMenu({
        customId: `ticket-remove-button:${buttonInteraction.id}`,
        ownerId: buttonInteraction.user.id,
        singleUse: true,
        handler: async (userSelectInteraction) => {
          await HandleUserRemoval(
            userSelectInteraction,
            ticket,
            ticketManager,
            logger
          );
        },
        expiresInMs: 60000,
      });

      const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

      await buttonInteraction.followUp({
        content: "Select users to remove from this ticket:",
        components: [row.toJSON()],
        ephemeral: true,
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}
