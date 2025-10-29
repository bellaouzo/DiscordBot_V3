import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { EmbedFactory } from "../../../../Utilities";
import { CreateTicketServices, ValidateTicketChannelOrReply, GetTicketOrReply, HasStaffPermissions } from "../validation/TicketValidation";

export async function HandleTicketClaim(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  if (!HasStaffPermissions(interaction.member)) {
    await interactionResponder.Reply(interaction, {
      content: "You need staff permissions to claim tickets.",
      ephemeral: true,
    });
    return;
  }

  const { ticketDb } = CreateTicketServices(logger, interaction.guild!);
  const ticket = await GetTicketOrReply(
    ticketDb,
    interaction.channel as TextChannel,
    interaction,
    interactionResponder
  );

  if (!ticket) return;

  const success = await ticketDb.UpdateTicketStatus(
    ticket.id,
    "claimed",
    interaction.user.id
  );

  if (success) {
    await interactionResponder.Reply(interaction, {
      content: `Ticket claimed by ${interaction.user.tag}.`,
    });

    const embed = EmbedFactory.CreateTicketClaimed(
      ticket.id,
      interaction.user.id
    );
    if ("send" in interaction.channel!) {
      await (interaction.channel as TextChannel).send({
        embeds: [embed.toJSON()],
      });
    }

    logger.Info("Ticket claimed", {
      extra: { ticketId: ticket.id, claimedBy: interaction.user.id },
    });
  } else {
    await interactionResponder.Reply(interaction, {
      content: "Failed to claim ticket.",
      ephemeral: true,
    });
  }
}
