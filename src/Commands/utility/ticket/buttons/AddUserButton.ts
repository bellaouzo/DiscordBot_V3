import { ButtonInteraction, Guild, ActionRowData, ActionRowComponentData } from "discord.js";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { TicketDatabase, Ticket } from "../../../../Database";
import { Logger } from "../../../../Shared/Logger";
import { EmbedFactory, ComponentFactory } from "../../../../Utilities";
import { CreateTicketManager } from "../../../../Utilities/TicketManager";
import { UserSelectMenuRouter } from "../../../../Shared/UserSelectMenuRouter";
import { BUTTON_EXPIRATION_MS } from "../types/TicketTypes";
import { HandleUserSelection } from "../components/UserSelectionMenu";

export async function RegisterAddUserButton(
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
    customId: `ticket:${interactionId}:add:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);

      const member = await guild.members.fetch(buttonInteraction.user.id);
      const ticketManager = CreateTicketManager({
        guild,
        logger,
        ticketDb,
      });

      if (
        !ticketManager.CanUserAddParticipants(
          ticket,
          buttonInteraction.user.id,
          member
        )
      ) {
        return;
      }

      const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
        customId: `ticket-add-button:${buttonInteraction.id}`,
        placeholder: "Select users to add to this ticket...",
        minValues: 1,
        maxValues: 10,
      });

      userSelectMenuRouter.RegisterUserSelectMenu({
        customId: `ticket-add-button:${buttonInteraction.id}`,
        ownerId: buttonInteraction.user.id,
        singleUse: true,
        handler: async (userSelectInteraction) => {
          await HandleUserSelection(
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
        embeds: [
          EmbedFactory.Create({
            title: "👥 Add Users to Ticket",
            description: `Select users to add to Ticket #${ticket.id}.`,
            color: 0x5865f2,
          }).toJSON(),
        ],
        components: [
          row.toJSON(),
        ] as unknown as ActionRowData<ActionRowComponentData>[],
        ephemeral: true,
      });

      logger.Info("Add user button clicked", {
        extra: { ticketId: ticket.id, clickedBy: buttonInteraction.user.id },
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}
