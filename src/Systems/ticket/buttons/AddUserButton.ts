import {
  ButtonInteraction,
  Guild,
  ActionRowData,
  ActionRowComponentData,
} from "discord.js";
import { ComponentRouter } from "@shared/ComponentRouter";
import { ButtonResponder } from "@responders";
import { TicketDatabase, Ticket } from "@database";
import { Logger } from "@shared/Logger";
import {
  EmbedFactory,
  ComponentFactory,
  CreateTicketManager,
  GuildResourceLocator,
} from "@utilities";
import { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import { BUTTON_EXPIRATION_MS } from "@systems/Ticket/types/TicketTypes";
import { HandleUserSelection } from "@systems/Ticket/components/UserSelectionMenu";

export async function RegisterAddUserButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  interactionId: string,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild,
  userSelectMenuRouter: UserSelectMenuRouter,
  guildResourceLocator: GuildResourceLocator
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:add:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);

      const member = await guildResourceLocator.GetMember(
        buttonInteraction.user.id
      );
      const ticketManager = CreateTicketManager({
        guild,
        logger,
        ticketDb,
        guildResourceLocator,
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
            ticketManager
          );
        },
        expiresInMs: 60000,
      });

      const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

      await buttonResponder.FollowUp(buttonInteraction, {
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
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}


