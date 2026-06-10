import type {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";
import type {
  CommandContext,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware/CommandConfig";

import { HandleTicketCreate } from "@systems/Ticket/handlers/CreateHandler";
import { HandleTicketList } from "@systems/Ticket/handlers/ListHandler";
import { HandleTicketTranscript } from "@systems/Ticket/handlers/TranscriptHandler";
import { HandleTicketReopen } from "@systems/Ticket/handlers/ReopenHandler";
import { HandleTicketTag } from "@systems/Ticket/handlers/TagHandler";
import { HandleTicketConfig } from "@systems/Ticket/handlers/ConfigHandler";
import { HandleTicketPanel } from "@systems/Ticket/TicketPanelFlow";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecuteTicket(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommandGroup === "config") {
    await HandleTicketConfig(interaction, context);
    return;
  }

  switch (subcommand) {
    case "open":
      await HandleTicketCreate(interaction, context);
      break;
    case "panel":
      await HandleTicketPanel(interaction, context);
      break;
    case "list":
      await HandleTicketList(interaction, context);
      break;
    case "transcript":
      await HandleTicketTranscript(interaction, context);
      break;
    case "reopen":
      await HandleTicketReopen(interaction, context);
      break;
    case "tag":
      await HandleTicketTag(interaction, context);
      break;
    case "about":
      await ReplyWithFeatureAbout(interaction, context, "ticket");
      break;
  }
}

export const TicketCommand = CreateCommand({
  name: "ticket",
  description: "Create and manage support tickets",
  group: "utility",
  config: Config.utility(3),
  configure: (builder: SlashCommandBuilder) => {
    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand.setName("open").setDescription("Open a new support ticket"),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("panel")
        .setDescription(
          "Post a ticket panel with an Open Ticket button (Staff)",
        ),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("list")
        .setDescription("View your tickets or the server queue (Staff)")
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName("scope")
            .setDescription("Whose tickets to show")
            .addChoices(
              { name: "Mine", value: "mine" },
              { name: "Server queue (Staff)", value: "server" },
            ),
        ),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("transcript")
        .setDescription(
          "Generate a transcript of the current ticket (Staff only)",
        ),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("reopen")
        .setDescription("Reopen a closed ticket into a new channel (Staff)"),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("tag")
        .setDescription("Add, remove, or list staff tags on this ticket")
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
              { name: "list", value: "list" },
            ),
        )
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName("tag")
            .setDescription("Tag text (required for add/remove)")
            .setRequired(false),
        ),
    );

    builder.addSubcommandGroup((group: SlashCommandSubcommandGroupBuilder) =>
      group
        .setName("config")
        .setDescription("Manage ticket categories (Staff only)")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("list")
            .setDescription("List configured ticket categories"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add a ticket category")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("Unique category key (e.g. billing)")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("label")
                .setDescription("Display label")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("Short description for the select menu")
                .setRequired(false),
            )
            .addStringOption((option) =>
              option
                .setName("emoji")
                .setDescription("Emoji shown in the category list")
                .setRequired(false),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("edit")
            .setDescription("Edit a ticket category")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("Category key to edit")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("label")
                .setDescription("New display label")
                .setRequired(false),
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("New description")
                .setRequired(false),
            )
            .addStringOption((option) =>
              option
                .setName("emoji")
                .setDescription("New emoji")
                .setRequired(false),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove a ticket category")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("Category key to remove")
                .setRequired(true),
            ),
        ),
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("about")
        .setDescription(
          "Learn what support tickets are and how to set them up",
        ),
    );
  },
  execute: ExecuteTicket,
});
