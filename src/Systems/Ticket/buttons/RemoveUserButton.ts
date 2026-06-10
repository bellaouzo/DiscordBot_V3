import type {
  ButtonInteraction,
  Guild,
  ActionRowComponentData,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { ButtonResponder } from "@responders";
import type { DatabaseSet } from "@database";
import type { Logger } from "@shared/Logger";
import { ComponentFactory, EmbedFactory, ToActionRowData } from "@utilities";
import type { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import {
  CreateTicketServices,
  ParseTicketButtonCustomId,
  CanUserRemoveParticipants,
} from "@systems/Ticket/validation/TicketValidation";
import { HandleUserRemoval } from "@systems/Ticket/components/UserSelectionMenu";

export async function HandleRemoveUserButton(
  buttonInteraction: ButtonInteraction,
  options: {
    buttonResponder: ButtonResponder;
    userSelectMenuRouter: UserSelectMenuRouter;
    databases: DatabaseSet;
    logger: Logger;
    guild: Guild;
  },
): Promise<void> {
  const parsed = ParseTicketButtonCustomId(buttonInteraction.customId);
  if (!parsed || parsed.action !== "remove") {
    return;
  }

  const ticket = options.databases.ticketDb.GetTicket(parsed.ticketId);
  if (!ticket || ticket.status === "closed") {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Ticket Unavailable",
          description: "This ticket is no longer open.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { guildResourceLocator, settings } = CreateTicketServices(
    options.logger,
    options.guild,
    options.databases.ticketDb,
    options.databases.serverDb,
  );

  const member = await guildResourceLocator.GetMember(
    buttonInteraction.user.id,
  );

  if (
    !CanUserRemoveParticipants(ticket, buttonInteraction.user.id, member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Permission Denied",
          description: "You cannot remove users from this ticket.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const activeParticipants = options.databases.ticketDb.GetActiveParticipants(
    ticket.id,
  );
  const participantIds = activeParticipants
    .filter((p) => p.user_id !== ticket.user_id)
    .map((p) => p.user_id);

  if (participantIds.length === 0) {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "No Participants",
          description: "There are no users to remove from this ticket.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await options.buttonResponder.DeferUpdate(buttonInteraction);

  const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
    customId: `ticket-remove-button:${buttonInteraction.id}`,
    placeholder: "Select users to remove from this ticket...",
    minValues: 1,
    maxValues: Math.min(participantIds.length, 10),
  });

  options.userSelectMenuRouter.RegisterUserSelectMenu({
    customId: `ticket-remove-button:${buttonInteraction.id}`,
    ownerId: buttonInteraction.user.id,
    singleUse: true,
    handler: async (userSelectInteraction) => {
      const { ticketManager: manager } = CreateTicketServices(
        options.logger,
        options.guild,
        options.databases.ticketDb,
        options.databases.serverDb,
      );
      await HandleUserRemoval(userSelectInteraction, ticket, manager);
    },
    expiresInMs: 60000,
  });

  const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

  await options.buttonResponder.FollowUp(buttonInteraction, {
    embeds: [
      EmbedFactory.Create({
        title: "Remove Participants",
        description: "Select users to remove from this ticket:",
      }).toJSON(),
    ],
    components: [ToActionRowData<ActionRowComponentData>(row)],
    flags: MessageFlags.Ephemeral,
  });
}
