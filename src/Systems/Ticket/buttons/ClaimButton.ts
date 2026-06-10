import { ButtonInteraction, MessageFlags } from "discord.js";
import { ButtonResponder } from "@responders";
import { TicketDatabase } from "@database";
import { EmbedFactory, ResolveInteractionMember } from "@utilities";
import {
  HasStaffPermissions,
  ParseTicketButtonCustomId,
} from "@systems/Ticket/validation/TicketValidation";
import { DatabaseSet } from "@database";
import { Logger } from "@shared/Logger";

export async function HandleClaimButton(
  buttonInteraction: ButtonInteraction,
  options: {
    buttonResponder: ButtonResponder;
    ticketDb: TicketDatabase;
    logger: Logger;
    databases: DatabaseSet;
  },
): Promise<void> {
  const parsed = ParseTicketButtonCustomId(buttonInteraction.customId);
  if (!parsed || parsed.action !== "claim") {
    return;
  }

  const settings = options.databases.serverDb.GetGuildSettings(
    buttonInteraction.guild!.id,
  );
  const member = await ResolveInteractionMember(buttonInteraction);

  if (
    !HasStaffPermissions(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Permission Denied",
          description: "You need staff permissions to claim tickets.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const ticket = options.ticketDb.GetTicket(parsed.ticketId);
  if (!ticket || ticket.status === "closed") {
    await options.buttonResponder.Reply(buttonInteraction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Ticket Unavailable",
          description: "This ticket is no longer available to claim.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await options.buttonResponder.DeferUpdate(buttonInteraction);

  options.ticketDb.UpdateTicketStatus(
    parsed.ticketId,
    "claimed",
    buttonInteraction.user.id,
  );

  const claimEmbed = EmbedFactory.CreateTicketClaimed(
    parsed.ticketId,
    buttonInteraction.user.id,
  );
  await options.buttonResponder.EditMessage(buttonInteraction, {
    embeds: [claimEmbed.toJSON()],
    components: [],
  });
}
