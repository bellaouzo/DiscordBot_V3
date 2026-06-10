import type { ChatInputCommandInteraction } from "discord.js";
import type {
  CommandContext,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
} from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { HandleCreate } from "@commands/Utility/Giveaway/GiveawayCreateFlow";
import { HandleEnd } from "@commands/Utility/Giveaway/GiveawayEndFlow";
import { HandleReroll } from "@commands/Utility/Giveaway/GiveawayRerollFlow";
import { HandleList } from "@commands/Utility/Giveaway/GiveawayListFlow";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecuteGiveaway(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case "create":
      await HandleCreate(interaction, context);
      break;
    case "end":
      await HandleEnd(interaction, context);
      break;
    case "reroll":
      await HandleReroll(interaction, context);
      break;
    case "list":
      await HandleList(interaction, context);
      break;
    case "about":
      await ReplyWithFeatureAbout(interaction, context, "giveaway");
      break;
  }
}

export const GiveawayCommand = CreateCommand({
  name: "giveaway",
  description: "Create and manage giveaways",
  group: "utility",
  configure: (builder: SlashCommandBuilder) => {
    builder
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("create")
          .setDescription("Create a new giveaway")
          .addStringOption((opt: SlashCommandStringOption) =>
            opt
              .setName("prize")
              .setDescription("What you're giving away")
              .setRequired(true),
          )
          .addStringOption((opt: SlashCommandStringOption) =>
            opt
              .setName("duration")
              .setDescription("How long the giveaway lasts (e.g., 30m, 2h, 1d)")
              .setRequired(true),
          )
          .addIntegerOption((opt: SlashCommandIntegerOption) =>
            opt
              .setName("winners")
              .setDescription("Number of winners (default: 1)")
              .setMinValue(1)
              .setMaxValue(10),
          ),
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("end")
          .setDescription("End a giveaway early")
          .addStringOption((opt: SlashCommandStringOption) =>
            opt
              .setName("message_id")
              .setDescription("Message ID of the giveaway")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("reroll")
          .setDescription("Reroll winners for an ended giveaway")
          .addStringOption((opt: SlashCommandStringOption) =>
            opt
              .setName("message_id")
              .setDescription("Message ID of the giveaway")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub.setName("list").setDescription("List all active giveaways"),
      )
      .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
        sub
          .setName("about")
          .setDescription("Learn what giveaways are and how to run them"),
      );
  },
  config: Config.utility(5),
  execute: ExecuteGiveaway,
});
