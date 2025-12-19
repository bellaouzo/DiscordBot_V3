import {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  Guild,
  ActionRowData,
  ActionRowComponentData,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { TICKET_CATEGORIES, TicketDatabase } from "@database";
import {
  EmbedFactory,
  ComponentFactory,
  CreateTicketManager,
  GuildResourceLocator,
} from "@utilities";
import { Logger } from "@shared/Logger";
import { ComponentRouter } from "@shared/ComponentRouter";
import { ButtonResponder } from "@responders";
import { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import { CreateTicketServices } from "@systems/ticket/validation/TicketValidation";
import { RegisterClaimButton } from "@systems/ticket/buttons/ClaimButton";
import { RegisterAddUserButton } from "@systems/ticket/buttons/AddUserButton";
import { RegisterRemoveUserButton } from "@systems/ticket/buttons/RemoveUserButton";
import { RegisterCloseButton } from "@systems/ticket/buttons/CloseButton";

export async function HandleTicketCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const {
    interactionResponder,
    selectMenuRouter,
    componentRouter,
    buttonResponder,
    userSelectMenuRouter,
  } = context.responders;
  const { logger } = context;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id
  );

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(
      logger,
      interaction.guild,
      context.databases.ticketDb,
      { ticketCategoryId: settings?.ticket_category_id ?? null }
    );

  const deferred = await interactionResponder.Defer(interaction, true);
  if (!deferred.success) {
    return;
  }

  const selectMenu = ComponentFactory.CreateSelectMenu({
    customId: `ticket-create:${interaction.id}`,
    placeholder: "Select a ticket category...",
    minValues: 1,
    maxValues: 1,
    options: TICKET_CATEGORIES.map((cat) => ({
      label: cat.label,
      description: cat.description,
      emoji: cat.emoji,
      value: cat.value,
    })),
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: `ticket-create:${interaction.id}`,
    ownerId: interaction.user.id,
    singleUse: true,
    handler: async (selectInteraction: StringSelectMenuInteraction) => {
      await HandleTicketCategorySelection(
        selectInteraction,
        ticketManager,
        componentRouter,
        buttonResponder,
        logger,
        ticketDb,
        interaction.guild!,
        userSelectMenuRouter,
        guildResourceLocator
      );
    },
    expiresInMs: 30000,
  });

  const row = ComponentFactory.CreateSelectMenuRow(selectMenu);

  await interactionResponder.Edit(interaction, {
    embeds: [
      EmbedFactory.Create({
        title: "🎫 Create a Ticket",
        description: "Select a category for your ticket below.",
        color: 0x5865f2,
      }).toJSON(),
    ],
    components: [
      row.toJSON(),
    ] as unknown as ActionRowData<ActionRowComponentData>[],
    ephemeral: true,
  });
}

async function HandleTicketCategorySelection(
  selectInteraction: StringSelectMenuInteraction,
  ticketManager: ReturnType<typeof CreateTicketManager>,
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild,
  userSelectMenuRouter: UserSelectMenuRouter,
  guildResourceLocator: GuildResourceLocator
): Promise<void> {
  const selectedCategory = selectInteraction.values[0];
  const categoryInfo = TICKET_CATEGORIES.find(
    (c) => c.value === selectedCategory
  );

  if (!categoryInfo) {
    await selectInteraction.deferReply({ flags: MessageFlags.Ephemeral });
    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateError({
          title: "Invalid Category",
          description: "Invalid category selected.",
        }).toJSON(),
      ],
    });
    return;
  }

  await selectInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { ticket, channel } = await ticketManager.CreateTicket({
      userId: selectInteraction.user.id,
      category: selectedCategory,
    });

    const embed = ticketManager.CreateTicketEmbed(ticket);
    const buttons = ticketManager.CreateTicketButtons(
      ticket.id,
      selectInteraction.id
    );

    await RegisterClaimButton(
      componentRouter,
      buttonResponder,
      ticket,
      selectInteraction.id,
      ticketDb
    );
    await RegisterAddUserButton(
      componentRouter,
      buttonResponder,
      ticket,
      selectInteraction.id,
      logger,
      ticketDb,
      guild,
      userSelectMenuRouter,
      guildResourceLocator
    );
    await RegisterRemoveUserButton(
      componentRouter,
      buttonResponder,
      ticket,
      selectInteraction.id,
      logger,
      ticketDb,
      guild,
      userSelectMenuRouter,
      guildResourceLocator
    );
    await RegisterCloseButton(
      componentRouter,
      buttonResponder,
      ticket,
      selectInteraction.id,
      logger,
      ticketDb,
      guild,
      guildResourceLocator
    );

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
    });
  } catch (error) {
    logger.Error("Failed to create ticket", { error });
    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateError({
          title: "Ticket Creation Failed",
          description: "Failed to create ticket. Please try again later.",
        }).toJSON(),
      ],
    });
  }
}
