import { ButtonInteraction, Guild } from "discord.js";
import { ComponentRouter } from "@shared/ComponentRouter";
import { ButtonResponder } from "@responders";
import { TicketDatabase, Ticket } from "@database";
import { Logger } from "@shared/Logger";
import {
  ComponentFactory,
  CreateTicketManager,
  EmbedFactory,
  GuildResourceLocator,
} from "@utilities";
import { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
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
  userSelectMenuRouter: UserSelectMenuRouter,
  guildResourceLocator: GuildResourceLocator
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:remove:${ticket.id}`,
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
        await buttonResponder.FollowUp(buttonInteraction, {
          embeds: [
            EmbedFactory.CreateWarning({
              title: "No Participants",
              description: "There are no users to remove from this ticket.",
            }).toJSON(),
          ],
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
          await HandleUserRemoval(userSelectInteraction, ticket, ticketManager);
        },
        expiresInMs: 60000,
      });

      const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

      await buttonInteraction.followUp({
        embeds: [
          EmbedFactory.Create({
            title: "Remove Participants",
            description: "Select users to remove from this ticket:",
          }).toJSON(),
        ],
        components: [row.toJSON()],
        ephemeral: true,
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}
