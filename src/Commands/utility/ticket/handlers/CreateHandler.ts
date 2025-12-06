import {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  Guild,
  ActionRowData,
  ActionRowComponentData,
} from "discord.js";
import { CommandContext } from "../../../CommandFactory";
import { TICKET_CATEGORIES } from "../../../../Database";
import {
  EmbedFactory,
  ComponentFactory,
  CreateTicketManager,
} from "../../../../Utilities";
import { Logger } from "../../../../Shared/Logger";
import { ComponentRouter } from "../../../../Shared/ComponentRouter";
import { ButtonResponder } from "../../../../Responders";
import { UserSelectMenuRouter } from "../../../../Shared/UserSelectMenuRouter";
import { CreateTicketServices } from "../validation/TicketValidation";
import { RegisterClaimButton } from "../buttons/ClaimButton";
import { RegisterAddUserButton } from "../buttons/AddUserButton";
import { RegisterRemoveUserButton } from "../buttons/RemoveUserButton";
import { RegisterCloseButton } from "../buttons/CloseButton";

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
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const { ticketDb, ticketManager, guildResourceLocator } =
    CreateTicketServices(logger, interaction.guild);

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
    expiresInMs: 60000,
  });

  const row = ComponentFactory.CreateSelectMenuRow(selectMenu);

  await interactionResponder.Reply(interaction, {
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
  ticketDb: any,
  guild: Guild,
  userSelectMenuRouter: UserSelectMenuRouter,
  guildResourceLocator: any
): Promise<void> {
  const selectedCategory = selectInteraction.values[0];
  const categoryInfo = TICKET_CATEGORIES.find(
    (c) => c.value === selectedCategory
  );

  if (!categoryInfo) {
    await selectInteraction.deferReply({ ephemeral: true });
    await selectInteraction.editReply({
      content: "Invalid category selected.",
    });
    return;
  }

  await selectInteraction.deferReply({ ephemeral: true });

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
      content: "Failed to create ticket. Please try again later.",
    });
  }
}
