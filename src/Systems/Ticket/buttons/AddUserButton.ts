import {
  ButtonInteraction,
  Guild,
  ActionRowComponentData,
  MessageFlags
} from "discord.js";
import { ButtonResponder } from "@responders";
import { DatabaseSet } from "@database";
import { Logger } from "@shared/Logger";
import {
  ComponentFactory,
  EmbedFactory,
  ToActionRowData,
} from "@utilities";
import { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import {
  CreateTicketServices,
  ParseTicketButtonCustomId,
} from "@systems/Ticket/validation/TicketValidation";
import { HandleUserSelection } from "@systems/Ticket/components/UserSelectionMenu";

export async function HandleAddUserButton(
  buttonInteraction: ButtonInteraction,
  options: {
    buttonResponder: ButtonResponder;
    userSelectMenuRouter: UserSelectMenuRouter;
    databases: DatabaseSet;
    logger: Logger;
    guild: Guild;
  }
): Promise<void> {
  const parsed = ParseTicketButtonCustomId(buttonInteraction.customId);
  if (!parsed || parsed.action !== "add") {
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

  const { ticketManager, guildResourceLocator, settings } =
    CreateTicketServices(
      options.logger,
      options.guild,
      options.databases.ticketDb,
      options.databases.serverDb
    );

  const member = await guildResourceLocator.GetMember(
    buttonInteraction.user.id
  );

  if (
    !ticketManager.CanUserAddParticipants(
      ticket,
      buttonInteraction.user.id,
      member,
      {
        adminRoleIds: settings?.admin_role_ids,
        modRoleIds: settings?.mod_role_ids,
      }
    )
  ) {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Permission Denied",
          description: "You cannot add users to this ticket.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await options.buttonResponder.DeferUpdate(buttonInteraction);

  const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
    customId: `ticket-add-button:${buttonInteraction.id}`,
    placeholder: "Select users to add to this ticket...",
    minValues: 1,
    maxValues: 10,
  });

  options.userSelectMenuRouter.RegisterUserSelectMenu({
    customId: `ticket-add-button:${buttonInteraction.id}`,
    ownerId: buttonInteraction.user.id,
    singleUse: true,
    handler: async (userSelectInteraction) => {
      const { ticketManager: manager } = CreateTicketServices(
        options.logger,
        options.guild,
        options.databases.ticketDb,
        options.databases.serverDb
      );
      await HandleUserSelection(userSelectInteraction, ticket, manager);
    },
    expiresInMs: 60000,
  });

  const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

  await options.buttonResponder.FollowUp(buttonInteraction, {
    embeds: [
      EmbedFactory.Create({
        title: "👥 Add Users to Ticket",
        description: `Select users to add to Ticket #${ticket.id}.`,
        color: 0x5865f2,
      }).toJSON(),
    ],
    components: [ToActionRowData<ActionRowComponentData>(row)],
    flags: MessageFlags.Ephemeral,
  });
}
