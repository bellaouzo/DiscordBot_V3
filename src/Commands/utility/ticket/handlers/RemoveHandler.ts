import {
  ChatInputCommandInteraction,
  TextChannel,
  ActionRowData,
  ActionRowComponentData,
  UserSelectMenuInteraction,
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory, ComponentFactory } from "@utilities";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
} from "../validation/TicketValidation";
import { HandleUserRemoval } from "../components/UserSelectionMenu";

export async function HandleTicketRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, userSelectMenuRouter } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(logger, interaction.guild!);
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

  const member = await guildResourceLocator.GetMember(interaction.user.id);
  if (
    !ticketManager.CanUserRemoveParticipants(
      ticket,
      interaction.user.id,
      member
    )
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description:
        "You don't have permission to remove users from this ticket.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  // Get active participants (excluding ticket owner)
  const activeParticipants = ticketDb.GetActiveParticipants(ticket.id);
  const participantIds = activeParticipants
    .filter((p) => p.user_id !== ticket.user_id)
    .map((p) => p.user_id);

  if (participantIds.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Participants",
      description: "There are no users to remove from this ticket.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
    customId: `ticket-remove:${interaction.id}`,
    placeholder: "Select users to remove from this ticket...",
    minValues: 1,
    maxValues: Math.min(participantIds.length, 10),
  });

  userSelectMenuRouter.RegisterUserSelectMenu({
    customId: `ticket-remove:${interaction.id}`,
    ownerId: interaction.user.id,
    singleUse: true,
    handler: async (userSelectInteraction: UserSelectMenuInteraction) => {
      await HandleUserRemoval(userSelectInteraction, ticket, ticketManager);
    },
    expiresInMs: 60000,
  });

  const row = ComponentFactory.CreateUserSelectMenuRow(userSelectMenu);

  await interactionResponder.Reply(interaction, {
    embeds: [
      EmbedFactory.Create({
        title: "👤 Remove Users from Ticket",
        description: `Select users to remove from Ticket #${ticket.id}.`,
        color: 0x5865f2,
      }).toJSON(),
    ],
    components: [
      row.toJSON(),
    ] as unknown as ActionRowData<ActionRowComponentData>[],
    ephemeral: true,
  });
}
