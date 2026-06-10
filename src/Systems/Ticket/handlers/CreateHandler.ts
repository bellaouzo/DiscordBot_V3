import {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  Guild,
  ActionRowComponentData,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  EmbedFactory,
  ComponentFactory,
  CreateTicketManager,
  ToActionRowData,
} from "@utilities";
import { CreateTicketServices } from "@systems/Ticket/validation/TicketValidation";
import { InteractionResponder } from "@responders";

const TICKET_CREATE_SELECT_TIMEOUT_MS = 5 * 60 * 1000;

export interface BeginTicketCreationOptions {
  context: CommandContext;
  guild: Guild;
  userId: string;
  sourceInteractionId: string;
  deferReply: () => Promise<void>;
  editReply: (
    payload: Parameters<InteractionResponder["Edit"]>[1]
  ) => Promise<void>;
}

export async function BeginTicketCreation(
  options: BeginTicketCreationOptions
): Promise<void> {
  const { context, guild, userId, sourceInteractionId } = options;
  const { selectMenuRouter } = context.responders;
  const { logger } = context;

  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const { ticketDb, ticketManager } = CreateTicketServices(
    logger,
    guild,
    context.databases.ticketDb,
    context.databases.serverDb,
    { ticketCategoryId: settings?.ticket_category_id ?? null }
  );

  const activeTickets = ticketDb.GetActiveUserTickets(userId, guild.id);
  if (activeTickets.length > 0) {
    const existing = activeTickets[0];
    const channelMention = existing.channel_id
      ? `<#${existing.channel_id}>`
      : "your existing ticket";

    await options.deferReply();
    await options.editReply({
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Ticket Already Open",
          description: `You already have an open ticket (#${existing.id}). Please use ${channelMention} or close it before opening another.`,
        }).toJSON(),
      ],
      components: [],
    });
    return;
  }

  const categories = ticketDb.EnsureCategoryConfigs(guild.id);

  await options.deferReply();

  const selectMenu = ComponentFactory.CreateSelectMenu({
    customId: `ticket-create:${sourceInteractionId}`,
    placeholder: "Select a ticket category...",
    minValues: 1,
    maxValues: 1,
    options: categories.map((cat) => ({
      label: cat.label,
      description: cat.description,
      emoji: cat.emoji,
      value: cat.value,
    })),
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: `ticket-create:${sourceInteractionId}`,
    ownerId: userId,
    singleUse: true,
    handler: async (selectInteraction: StringSelectMenuInteraction) => {
      await HandleTicketCategorySelection(
        selectInteraction,
        ticketManager,
        ticketDb,
        guild
      );
    },
    expiresInMs: TICKET_CREATE_SELECT_TIMEOUT_MS,
  });

  const row = ComponentFactory.CreateSelectMenuRow(selectMenu);

  await options.editReply({
    embeds: [
      EmbedFactory.Create({
        title: "🎫 Open a Ticket",
        description: "Select a category for your ticket below.",
        color: 0x5865f2,
      }).toJSON(),
    ],
    components: [ToActionRowData<ActionRowComponentData>(row)],
  });
}

export async function HandleTicketCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
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

  await BeginTicketCreation({
    context,
    guild: interaction.guild,
    userId: interaction.user.id,
    sourceInteractionId: interaction.id,
    deferReply: async () => {},
    editReply: async (payload) => {
      await interactionResponder.Edit(interaction, payload);
    },
  });
}

async function HandleTicketCategorySelection(
  selectInteraction: StringSelectMenuInteraction,
  ticketManager: ReturnType<typeof CreateTicketManager>,
  ticketDb: ReturnType<typeof CreateTicketServices>["ticketDb"],
  guild: Guild
): Promise<void> {
  const selectedCategory = selectInteraction.values[0];
  const categories = ticketDb.EnsureCategoryConfigs(guild.id);
  const categoryInfo = categories.find((c) => c.value === selectedCategory);

  await selectInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!categoryInfo) {
    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateError({
          title: "Invalid Category",
          description: "Invalid category selected.",
        }).toJSON(),
      ],
      components: [],
    });
    return;
  }

  const activeTickets = ticketDb.GetActiveUserTickets(
    selectInteraction.user.id,
    guild.id
  );
  if (activeTickets.length > 0) {
    const existing = activeTickets[0];
    const channelMention = existing.channel_id
      ? `<#${existing.channel_id}>`
      : "your existing ticket";

    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Ticket Already Open",
          description: `You already have an open ticket (#${existing.id}). Please use ${channelMention}.`,
        }).toJSON(),
      ],
      components: [],
    });
    return;
  }

  try {
    const { ticket, channel } = await ticketManager.CreateTicket({
      userId: selectInteraction.user.id,
      category: selectedCategory,
    });

    const embed = ticketManager.CreateTicketEmbed(ticket);
    const buttons = ticketManager.CreateTicketButtons(ticket.id);

    if ("send" in channel) {
      await channel.send({
        embeds: [embed.toJSON()],
        components: [buttons.toJSON()],
      });
    }

    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateSuccess({
          title: "🎫 Ticket Created",
          description: `Your ticket has been created! View it in ${channel}.`,
        }).toJSON(),
      ],
      components: [],
    });
  } catch {
    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateError({
          title: "Ticket Creation Failed",
          description: "Failed to create ticket. Please try again later.",
        }).toJSON(),
      ],
      components: [],
    });
  }
}
