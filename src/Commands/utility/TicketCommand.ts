import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  GuildMember,
  APIInteractionGuildMember,
  ButtonInteraction,
  TextChannel,
  Guild,
  StringSelectMenuInteraction,
} from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware, ErrorMiddleware } from "../Middleware";
import { Config } from "../Middleware/CommandConfig";
import { TICKET_CATEGORIES, TicketDatabase, Ticket } from "../../Database";
import { EmbedFactory, ComponentFactory } from "../../Utilities";
import {
  CreateTicketManager,
  TicketManager,
} from "../../Utilities/TicketManager";
import { TranscriptGenerator } from "../../Utilities/TranscriptGenerator";
import { ComponentRouter } from "../../Shared/ComponentRouter";
import { Logger } from "../../Shared/Logger";
import { InteractionResponder, ButtonResponder } from "../../Responders";

const BUTTON_EXPIRATION_MS = 1000 * 60 * 60 * 24;

interface TicketServices {
  readonly ticketDb: TicketDatabase;
  readonly ticketManager: TicketManager;
}

function HasStaffPermissions(
  member: GuildMember | APIInteractionGuildMember | null
): boolean {
  if (!member || typeof member.permissions === "string") {
    return false;
  }
  return (
    member.permissions.has("ManageGuild") ||
    member.permissions.has("Administrator")
  );
}

function ValidateTicketChannel(
  channel: ChatInputCommandInteraction["channel"]
): boolean {
  return !!(channel && channel.isTextBased());
}

function CreateTicketServices(logger: Logger, guild: Guild): TicketServices {
  const ticketDb = new TicketDatabase(logger);
  const ticketManager = CreateTicketManager({
    guild,
    logger,
    ticketDb,
  });
  return { ticketDb, ticketManager };
}

async function RegisterClaimButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  logger: Logger,
  ticketDb: TicketDatabase
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:claim:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);
      if (!HasStaffPermissions(buttonInteraction.member)) {
        return;
      }

      ticketDb.UpdateTicketStatus(
        ticket.id,
        "claimed",
        buttonInteraction.user.id
      );

      const claimEmbed = EmbedFactory.CreateTicketClaimed(
        ticket.id,
        buttonInteraction.user.id
      );
      await buttonResponder.EditMessage(buttonInteraction, {
        embeds: [claimEmbed.toJSON()],
        components: [],
      });

      logger.Info("Ticket claimed via button", {
        extra: { ticketId: ticket.id, claimedBy: buttonInteraction.user.id },
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}

async function RegisterCloseButton(
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  ticket: Ticket,
  interactionId: string,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild
): Promise<void> {
  componentRouter.RegisterButton({
    customId: `ticket:${interactionId}:close:${ticket.id}`,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);

      const closeEmbed = EmbedFactory.CreateTicketClosed(
        ticket.id,
        buttonInteraction.user.id
      );
      await buttonResponder.EditMessage(buttonInteraction, {
        embeds: [closeEmbed.toJSON()],
        components: [],
      });

      const ticketManager = CreateTicketManager({
        guild,
        logger,
        ticketDb,
      });

      const messages = ticketDb.GetTicketMessages(ticket.id);
      const user = await buttonInteraction.client.users.fetch(ticket.user_id);

      const transcript = TranscriptGenerator.Generate({
        ticket,
        messages,
        user,
        guild,
      });

      const filename = TranscriptGenerator.GenerateFileName(ticket);

      await SendTicketLogs(
        ticketManager,
        transcript,
        filename,
        `Ticket #${ticket.id} closed by <@${buttonInteraction.user.id}>`,
        logger
      );

      await ticketManager.CloseTicket(
        ticket.id,
        buttonInteraction.user.id,
        false
      );

      logger.Info("Ticket closed via button", {
        extra: { ticketId: ticket.id, closedBy: buttonInteraction.user.id },
      });
    },
    expiresInMs: BUTTON_EXPIRATION_MS,
  });
}

async function SendTicketLogs(
  ticketManager: TicketManager,
  transcript: string,
  filename: string,
  message: string,
  logger: Logger
): Promise<void> {
  try {
    const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();
    if (logsChannel) {
      await logsChannel.send({
        content: message,
        files: [
          { name: filename, attachment: Buffer.from(transcript, "utf-8") },
        ],
      });
      logger.Info("Ticket logs sent successfully", {
        extra: { logsChannelId: logsChannel.id },
      });
    } else {
      logger.Error("Failed to get or create logs channel", {
        extra: { guildId: ticketManager },
      });
    }
  } catch (error) {
    logger.Error("Failed to send ticket logs", { error });
  }
}

async function GetTicketOrReply(
  ticketDb: TicketDatabase,
  channel: TextChannel,
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<Ticket | null> {
  const ticket = ticketDb.GetTicketByChannel(channel.id);
  if (!ticket) {
    await interactionResponder.Reply(interaction, {
      content: "This channel is not a ticket.",
      ephemeral: true,
    });
  }
  return ticket;
}

async function ValidateGuildOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<boolean> {
  if (!interaction.guild) {
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function ValidateTicketChannelOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<boolean> {
  if (!interaction.guild || !ValidateTicketChannel(interaction.channel)) {
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a ticket channel.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function ExecuteTicket(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === "create") {
    await HandleTicketCreate(interaction, context);
  } else if (subcommand === "list") {
    await HandleTicketList(interaction, context);
  } else if (subcommand === "close") {
    await HandleTicketClose(interaction, context);
  } else if (subcommand === "claim") {
    await HandleTicketClaim(interaction, context);
  } else if (subcommand === "transcript") {
    await HandleTicketTranscript(interaction, context);
  }
}

async function HandleTicketCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const {
    interactionResponder,
    selectMenuRouter,
    componentRouter,
    buttonResponder,
  } = context.responders;
  const { logger } = context;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) return;

  const { ticketDb, ticketManager } = CreateTicketServices(
    logger,
    interaction.guild!
  );

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
    handler: async (selectInteraction) => {
      await HandleTicketCategorySelection(
        selectInteraction,
        ticketManager,
        componentRouter,
        buttonResponder,
        logger,
        ticketDb,
        interaction.guild!
      );
    },
    expiresInMs: 60000,
  });

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu
  );

  await interactionResponder.Reply(interaction, {
    embeds: [
      EmbedFactory.Create({
        title: "🎫 Create a Ticket",
        description: "Select a category for your ticket below.",
        color: 0x5865f2,
      }).toJSON(),
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: [row.toJSON() as any],
    ephemeral: true,
  });
}

async function HandleTicketCategorySelection(
  selectInteraction: StringSelectMenuInteraction,
  ticketManager: TicketManager,
  componentRouter: ComponentRouter,
  buttonResponder: ButtonResponder,
  logger: Logger,
  ticketDb: TicketDatabase,
  guild: Guild
): Promise<void> {
  const selectedCategory = selectInteraction.values[0];
  const categoryInfo = TICKET_CATEGORIES.find(
    (c) => c.value === selectedCategory
  );

  if (!categoryInfo) {
    await selectInteraction.reply({
      content: "Invalid category selected.",
      ephemeral: true,
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
      logger,
      ticketDb
    );
    await RegisterCloseButton(
      componentRouter,
      buttonResponder,
      ticket,
      selectInteraction.id,
      logger,
      ticketDb,
      guild
    );

    const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();

    if ("send" in channel) {
      await channel.send({
        embeds: [embed.toJSON()],
        components: [buttons.toJSON()],
      });
    }

    logger.Info("Ticket logs channel ready", {
      extra: {
        guildId: guild.id,
        logsChannelId: logsChannel?.id,
        ticketId: ticket.id,
      },
    });

    await selectInteraction.editReply({
      embeds: [
        EmbedFactory.CreateSuccess({
          title: "🎫 Ticket Created",
          description: `Your ticket has been created! View it in ${channel}.`,
        }).toJSON(),
      ],
    });

    logger.Info("Ticket created via command", {
      extra: {
        ticketId: ticket.id,
        userId: selectInteraction.user.id,
        category: selectedCategory,
      },
    });
  } catch (error) {
    logger.Error("Failed to create ticket", { error });
    await selectInteraction.editReply({
      content: "Failed to create ticket. Please try again later.",
    });
  }
}

async function HandleTicketList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) return;

  const { ticketDb } = CreateTicketServices(logger, interaction.guild!);
  const tickets = ticketDb.GetUserTickets(
    interaction.user.id,
    interaction.guild!.id
  );

  const embed = EmbedFactory.CreateTicketList(tickets);

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });

  logger.Info("Ticket list viewed", {
    extra: { userId: interaction.user.id, ticketCount: tickets.length },
  });
}

async function HandleTicketClose(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  const { ticketDb, ticketManager } = CreateTicketServices(
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

  const embed = EmbedFactory.CreateTicketClosed(ticket.id, interaction.user.id);

  if ("send" in interaction.channel!) {
    await (interaction.channel as TextChannel).send({
      embeds: [embed.toJSON()],
    });
  }

  const messages = ticketDb.GetTicketMessages(ticket.id);
  const user = await interaction.client.users.fetch(ticket.user_id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: interaction.guild!,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  await SendTicketLogs(
    ticketManager,
    transcript,
    filename,
    `Ticket #${ticket.id} closed by <@${interaction.user.id}>`,
    logger
  );

  await interactionResponder.Reply(interaction, {
    content: "Ticket closed successfully.",
  });

  const success = await ticketManager.CloseTicket(
    ticket.id,
    interaction.user.id,
    false
  );

  if (success) {
    logger.Info("Ticket closed", {
      extra: { ticketId: ticket.id, closedBy: interaction.user.id },
    });
  } else {
    logger.Error("Failed to close ticket", {
      extra: { ticketId: ticket.id, closedBy: interaction.user.id },
    });
  }
}

async function HandleTicketClaim(
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

async function HandleTicketTranscript(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateTicketChannelOrReply(interaction, interactionResponder)))
    return;

  if (!HasStaffPermissions(interaction.member)) {
    await interactionResponder.Reply(interaction, {
      content: "You need staff permissions to generate transcripts.",
      ephemeral: true,
    });
    return;
  }

  const { ticketDb, ticketManager } = CreateTicketServices(
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

  const messages = ticketDb.GetTicketMessages(ticket.id);
  const user = await interaction.client.users.fetch(ticket.user_id);

  const transcript = TranscriptGenerator.Generate({
    ticket,
    messages,
    user,
    guild: interaction.guild!,
  });

  const filename = TranscriptGenerator.GenerateFileName(ticket);

  const logsChannel = await ticketManager.GetOrCreateTicketLogsChannel();

  if (logsChannel) {
    await logsChannel.send({
      content: `Transcript for Ticket #${ticket.id}`,
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
    });

    await interactionResponder.Reply(interaction, {
      content: "Transcript generated and sent to ticket-logs channel.",
      ephemeral: true,
    });
  } else {
    await interactionResponder.Reply(interaction, {
      content: "Generated ticket transcript:",
      files: [{ name: filename, attachment: Buffer.from(transcript, "utf-8") }],
      ephemeral: true,
    });
  }

  logger.Info("Ticket transcript generated", {
    extra: { ticketId: ticket.id, generatedBy: interaction.user.id },
  });
}

export const TicketCommand = CreateCommand({
  name: "ticket",
  description: "Create and manage support tickets",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  configure: (builder) => {
    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand.setName("create").setDescription("Create a new support ticket")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand.setName("list").setDescription("View your tickets")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand.setName("close").setDescription("Close the current ticket")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("claim")
        .setDescription("Claim a ticket for handling (Staff only)")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("transcript")
        .setDescription(
          "Generate a transcript of the current ticket (Staff only)"
        )
    );
  },
  execute: ExecuteTicket,
});
