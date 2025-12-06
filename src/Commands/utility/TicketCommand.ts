import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware, ErrorMiddleware } from "@middleware";
import { Config } from "@middleware/CommandConfig";

import { HandleTicketCreate } from "@commands/utility/ticket/handlers/CreateHandler";
import { HandleTicketList } from "@commands/utility/ticket/handlers/ListHandler";
import { HandleTicketClose } from "@commands/utility/ticket/handlers/CloseHandler";
import { HandleTicketClaim } from "@commands/utility/ticket/handlers/ClaimHandler";
import { HandleTicketTranscript } from "@commands/utility/ticket/handlers/TranscriptHandler";
import { HandleTicketAdd } from "@commands/utility/ticket/handlers/AddHandler";
import { HandleTicketRemove } from "@commands/utility/ticket/handlers/RemoveHandler";
import { HandleTicketReopen } from "@commands/utility/ticket/handlers/ReopenHandler";

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
  }
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
  },
  execute: ExecuteTicket,
});
