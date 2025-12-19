import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware/CommandConfig";

import { HandleTicketCreate } from "@systems/Ticket/handlers/CreateHandler";
import { HandleTicketList } from "@systems/Ticket/handlers/ListHandler";
import { HandleTicketClose } from "@systems/Ticket/handlers/CloseHandler";
import { HandleTicketClaim } from "@systems/Ticket/handlers/ClaimHandler";
import { HandleTicketTranscript } from "@systems/Ticket/handlers/TranscriptHandler";
import { HandleTicketAdd } from "@systems/Ticket/handlers/AddHandler";
import { HandleTicketRemove } from "@systems/Ticket/handlers/RemoveHandler";
import { HandleTicketReopen } from "@systems/Ticket/handlers/ReopenHandler";
import { HandleTicketTag } from "@systems/Ticket/handlers/TagHandler";

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
  } else if (subcommand === "add") {
    await HandleTicketAdd(interaction, context);
  } else if (subcommand === "remove") {
    await HandleTicketRemove(interaction, context);
  } else if (subcommand === "reopen") {
    await HandleTicketReopen(interaction, context);
  } else if (subcommand === "tag") {
    await HandleTicketTag(interaction, context);
  }
}

export const TicketCommand = CreateCommand({
  name: "ticket",
  description: "Create and manage support tickets",
  group: "utility",
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

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("add")
        .setDescription("Add users to the current ticket")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("remove")
        .setDescription("Remove users from the current ticket")
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("reopen")
        .setDescription("Reopen a closed ticket into a new channel (Staff)")
        .addIntegerOption((option) =>
          option
            .setName("ticket_id")
            .setDescription("Closed ticket ID to reopen")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Reason for reopening")
            .setRequired(true)
        )
    );

    builder.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName("tag")
        .setDescription("Add, remove, or list tags on this ticket")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
              { name: "list", value: "list" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("tag")
            .setDescription("Tag text (required for add/remove)")
            .setRequired(false)
        )
    );
  },
  execute: ExecuteTicket,
});


