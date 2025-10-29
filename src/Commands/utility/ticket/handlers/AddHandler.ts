import { ChatInputCommandInteraction, TextChannel, ActionRowData, ActionRowComponentData, UserSelectMenuInteraction } from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { EmbedFactory, ComponentFactory } from "../../../../Utilities";
import { CreateTicketServices, ValidateTicketChannelOrReply, GetTicketOrReply } from "../validation/TicketValidation";
import { HandleUserSelection } from "../components/UserSelectionMenu";

export async function HandleTicketAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, userSelectMenuRouter } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  const { ticketDb, ticketManager, guildResourceLocator } = CreateTicketServices(
    logger,
    interaction.guild!
  );
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

  const member = await guildResourceLocator.GetMember(interaction.user.id);
  if (
    !ticketManager.CanUserAddParticipants(ticket, interaction.user.id, member)
  ) {
    await interactionResponder.Reply(interaction, {
      content: "You don't have permission to add users to this ticket.",
      ephemeral: true,
    });
    return;
  }

  const userSelectMenu = ComponentFactory.CreateUserSelectMenu({
    customId: `ticket-add:${interaction.id}`,
    placeholder: "Select users to add to this ticket...",
    minValues: 1,
    maxValues: 10,
  });

  userSelectMenuRouter.RegisterUserSelectMenu({
    customId: `ticket-add:${interaction.id}`,
    ownerId: interaction.user.id,
    singleUse: true,
    handler: async (userSelectInteraction: UserSelectMenuInteraction) => {
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

  await interactionResponder.Reply(interaction, {
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
}
