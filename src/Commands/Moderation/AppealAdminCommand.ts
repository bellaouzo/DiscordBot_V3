import { ChatInputCommandInteraction } from "discord.js";
import {
  CommandContext,
  CreateCommand,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
} from "@commands";
import { Config } from "@middleware";
import { HandleList, HandleReview } from "@commands/Moderation/Appeal/AppealReviewFlow";
import { HandlePanel } from "@commands/Moderation/Appeal/AppealPanelFlow";

async function ExecuteAppealAdmin(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === "panel") {
    await HandlePanel(interaction, context);
    return;
  }

  if (subcommand === "list") {
    await HandleList(interaction, context);
    return;
  }

  if (subcommand === "review") {
    await HandleReview(interaction, context);
  }
}

export const AppealAdminCommand = CreateCommand({
  name: "appeal-admin",
  description: "Staff tools for managing moderation appeals",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteAppealAdmin,
  configure: (builder: SlashCommandBuilder) => {
    builder
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("panel")
          .setDescription("Post an appeal panel in this channel")
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub.setName("list").setDescription("View open appeals")
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("review")
          .setDescription("Resolve an appeal")
          .addIntegerOption((option: SlashCommandIntegerOption) =>
            option
              .setName("appeal_id")
              .setDescription("Appeal ID to resolve")
              .setRequired(true)
          )
          .addStringOption((option: SlashCommandStringOption) =>
            option
              .setName("decision")
              .setDescription("Resolution decision")
              .setRequired(true)
              .addChoices(
                { name: "Approve", value: "approved" },
                { name: "Deny", value: "denied" }
              )
          )
          .addStringOption((option: SlashCommandStringOption) =>
            option
              .setName("review_reason")
              .setDescription("Reason for approval or denial")
              .setRequired(false)
          )
      );
  },
});
