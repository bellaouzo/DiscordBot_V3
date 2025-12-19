import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
  HasStaffPermissions,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketClaim(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  if (!HasStaffPermissions(interaction.member)) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Required",
      description: "You need staff permissions to claim tickets.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const { ticketDb } = CreateTicketServices(logger, interaction.guild!, context.databases.ticketDb);
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
    const replyEmbed = EmbedFactory.CreateSuccess({
      title: "Ticket Claimed",
      description: `Ticket claimed by ${interaction.user.tag}.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [replyEmbed.toJSON()],
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
  } else {
    const embed = EmbedFactory.CreateError({
      title: "Claim Failed",
      description: "Failed to claim ticket.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}



