import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  CreateTicketServices,
  ValidateGuildOrReply,
} from "@systems/Ticket/validation/TicketValidation";
import {
  EmbedFactory,
  TranscriptGenerator,
  CreateGuildResourceLocator,
} from "@utilities";
import { HasStaffPermissions } from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketReopen(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) {
    return;
  }

  const member = interaction.member as GuildMember | null;
  if (!member || !HasStaffPermissions(member)) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to reopen tickets.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const ticketId = interaction.options.getInteger("ticket_id", true);
  const reason = interaction.options.getString("reason") ?? null;

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild!.id
  );

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(
      logger,
      interaction.guild!,
      context.databases.ticketDb,
      {
        ticketCategoryId: settings?.ticket_category_id ?? null,
      }
    );

  try {
    const prior = ticketDb.GetTicket(ticketId);
    if (!prior) {
      const embed = EmbedFactory.CreateError({
        title: "Ticket Not Found",
        description: `No ticket found with ID ${ticketId}.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    if (prior.status !== "closed") {
      const embed = EmbedFactory.CreateWarning({
        title: "Ticket Not Closed",
        description: "Only closed tickets can be reopened.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const { ticket: newTicket, channel } = await ticketManager.ReopenTicket({
      priorTicketId: ticketId,
      reopenedBy: interaction.user.id,
      reason,
    });

    const messages = ticketDb.GetTicketMessages(prior.id);
    const participantHistory = ticketDb.GetParticipantHistory(prior.id);
    const locator =
      guildResourceLocator ??
      CreateGuildResourceLocator({ guild: interaction.guild!, logger });
    const member = await locator.GetMember(prior.user_id);
    const user =
      member?.user ||
      (await interaction.client.users.fetch(prior.user_id).catch(() => null));

    let transcriptBuffer: Buffer | null = null;
    if (user) {
      const transcript = TranscriptGenerator.Generate({
        ticket: prior,
        messages,
        user,
        guild: interaction.guild!,
        participantHistory,
      });
      transcriptBuffer = Buffer.from(transcript, "utf-8");
    }

    const auditEmbed = EmbedFactory.Create({
      title: "🔄 Ticket Reopened",
      description: `Ticket #${ticketId} reopened as Ticket #${newTicket.id}`,
      timestamp: true,
    });
    auditEmbed.addFields(
      { name: "User", value: `<@${newTicket.user_id}>`, inline: true },
      { name: "Reopened By", value: `<@${interaction.user.id}>`, inline: true },
      {
        name: "Reason",
        value: reason ?? "No reason provided",
        inline: false,
      }
    );

    await channel.send({
      embeds: [auditEmbed.toJSON()],
      files: transcriptBuffer
        ? [
            {
              attachment: transcriptBuffer,
              name: TranscriptGenerator.GenerateFileName(prior),
            },
          ]
        : [],
    });

    const replyEmbed = EmbedFactory.CreateSuccess({
      title: "Ticket Reopened",
      description: `Created new ticket channel <#${channel.id}> for Ticket #${newTicket.id}.`,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [replyEmbed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    logger.Error("Failed to reopen ticket", {
      error,
      extra: { ticketId },
    });
    throw error;
  } finally {
    void 0;
  }
}
