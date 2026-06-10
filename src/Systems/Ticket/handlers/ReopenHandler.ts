import {
  ChatInputCommandInteraction,
  GuildMember,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ActionRowComponentData,
  TextInputStyle,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  MessageFlags
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  CreateTicketServices,
  ValidateGuildOrReply,
  HasStaffPermissions,
} from "@systems/Ticket/validation/TicketValidation";
import {
  EmbedFactory,
  TranscriptGenerator,
  ComponentFactory,
  ToActionRowData,
} from "@utilities";

const REOPEN_SELECT_TIMEOUT_MS = 5 * 60 * 1000;

export async function HandleTicketReopen(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, selectMenuRouter, modalRouter } =
    context.responders;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) {
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild!.id
  );
  const member = interaction.member as GuildMember | null;

  if (
    !HasStaffPermissions(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to reopen tickets.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const deferred = await interactionResponder.Defer(interaction, true);
  if (!deferred.success) {
    return;
  }

  const closedTickets = context.databases.ticketDb.GetGuildTickets(
    interaction.guild!.id,
    "closed"
  );

  if (closedTickets.length === 0) {
    await interactionResponder.Edit(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "No Closed Tickets",
          description: "There are no closed tickets to reopen.",
        }).toJSON(),
      ],
      components: [],
    });
    return;
  }

  const selectMenu = ComponentFactory.CreateSelectMenu({
    customId: `ticket-reopen:${interaction.id}`,
    placeholder: "Select a closed ticket to reopen...",
    minValues: 1,
    maxValues: 1,
    options: closedTickets.slice(0, 25).map((ticket) => ({
      label: `Ticket #${ticket.id}`,
      description: `${ticket.category} — owner ${ticket.user_id}`,
      value: String(ticket.id),
    })),
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: `ticket-reopen:${interaction.id}`,
    ownerId: interaction.user.id,
    singleUse: true,
    expiresInMs: REOPEN_SELECT_TIMEOUT_MS,
    handler: async (selectInteraction: StringSelectMenuInteraction) => {
      const ticketId = Number.parseInt(selectInteraction.values[0], 10);
      const modalCustomId = `ticket-reopen-reason:${selectInteraction.id}:${ticketId}`;
      const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle(`Reopen Ticket #${ticketId}`);
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason for reopening")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
      );

      modalRouter.RegisterModal({
        customId: modalCustomId,
        ownerId: selectInteraction.user.id,
        singleUse: true,
        expiresInMs: REOPEN_SELECT_TIMEOUT_MS,
        handler: async (modalInteraction: ModalSubmitInteraction) => {
          await HandleReopenModal(modalInteraction, context, ticketId);
        },
      });

      await selectInteraction.showModal(modal);
    },
  });

  const row = ComponentFactory.CreateSelectMenuRow(selectMenu);

  await interactionResponder.Edit(interaction, {
    embeds: [
      EmbedFactory.Create({
        title: "Reopen Ticket",
        description: "Select a closed ticket to reopen.",
        color: 0x5865f2,
      }).toJSON(),
    ],
    components: [ToActionRowData<ActionRowComponentData>(row)],
  });
}

async function HandleReopenModal(
  modalInteraction: ModalSubmitInteraction,
  context: CommandContext,
  ticketId: number
): Promise<void> {
  const { logger } = context;

  await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const reason = modalInteraction.fields.getTextInputValue("reason");
  const settings = context.databases.serverDb.GetGuildSettings(
    modalInteraction.guild!.id
  );

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(
      logger,
      modalInteraction.guild!,
      context.databases.ticketDb,
      context.databases.serverDb,
      { ticketCategoryId: settings?.ticket_category_id ?? null }
    );

  try {
    const prior = ticketDb.GetTicket(ticketId);
    if (!prior || prior.status !== "closed") {
      await modalInteraction.editReply({
        embeds: [
          EmbedFactory.CreateError({
            title: "Ticket Not Available",
            description: "This ticket is no longer closed or could not be found.",
          }).toJSON(),
        ],
      });
      return;
    }

    const { ticket: newTicket, channel } = await ticketManager.ReopenTicket({
      priorTicketId: ticketId,
      reopenedBy: modalInteraction.user.id,
      reason,
    });

    const ticketEmbed = ticketManager.CreateTicketEmbed(newTicket);
    const buttons = ticketManager.CreateTicketButtons(newTicket.id);

    await channel.send({
      embeds: [ticketEmbed.toJSON()],
      components: [buttons.toJSON()],
    });

    const messages = ticketDb.GetTicketMessages(prior.id);
    const participantHistory = ticketDb.GetParticipantHistory(prior.id);
    const ticketMember = await guildResourceLocator.GetMember(prior.user_id);
    const user =
      ticketMember?.user ||
      (await modalInteraction.client.users.fetch(prior.user_id).catch(() => null));

    let transcriptBuffer: Buffer | null = null;
    if (user) {
      const transcript = TranscriptGenerator.Generate({
        ticket: prior,
        messages,
        user,
        guild: modalInteraction.guild!,
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
      {
        name: "Reopened By",
        value: `<@${modalInteraction.user.id}>`,
        inline: true,
      },
      { name: "Reason", value: reason, inline: false }
    );

    const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();
    if (logsChannel) {
      await logsChannel.send({
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
    }

    await modalInteraction.editReply({
      embeds: [
        EmbedFactory.CreateSuccess({
          title: "Ticket Reopened",
          description: `Created new ticket channel <#${channel.id}> for Ticket #${newTicket.id}.`,
        }).toJSON(),
      ],
    });
  } catch (error) {
    logger.Error("Failed to reopen ticket", {
      error,
      extra: { ticketId },
    });
    await modalInteraction.editReply({
      embeds: [
        EmbedFactory.CreateError({
          title: "Reopen Failed",
          description: "Failed to reopen the ticket. Please try again.",
        }).toJSON(),
      ],
    });
  }
}
