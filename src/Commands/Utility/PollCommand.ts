import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { HandleCreatePoll } from "@commands/Utility/Poll/CreateFlow";
import { HandleListPolls } from "@commands/Utility/Poll/ListFlow";
import { HandleEndPoll } from "@commands/Utility/Poll/EndFlow";
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@commands/Utility/Poll/PollShared";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecutePoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false) ?? "create";

  if (subcommand === "list") {
    await HandleListPolls(interaction, context);
    return;
  }

  if (subcommand === "end") {
    await HandleEndPoll(interaction, context);
    return;
  }

  if (subcommand === "about") {
    await ReplyWithFeatureAbout(interaction, context, "poll");
    return;
  }

  await HandleCreatePoll(interaction, context);
}

export const PollCommand = CreateCommand({
  name: "poll",
  description: "Create and manage native Discord polls",
  group: "utility",
  configure: (builder) => {
    builder.addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new poll")
        .addStringOption((option) =>
          option
            .setName("question")
            .setDescription("Question to ask")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("choice_1")
            .setDescription("Choice 1")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("choice_2")
            .setDescription("Choice 2")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("duration_minutes")
            .setDescription("How long the poll should run (minutes)")
            .setRequired(false)
            .setMinValue(MIN_DURATION_MINUTES)
            .setMaxValue(MAX_DURATION_MINUTES),
        )
        .addStringOption((option) =>
          option.setName("choice_3").setDescription("Choice 3"),
        )
        .addStringOption((option) =>
          option.setName("choice_4").setDescription("Choice 4"),
        )
        .addStringOption((option) =>
          option.setName("choice_5").setDescription("Choice 5"),
        )
        .addStringOption((option) =>
          option.setName("choice_6").setDescription("Choice 6"),
        )
        .addStringOption((option) =>
          option.setName("choice_7").setDescription("Choice 7"),
        )
        .addStringOption((option) =>
          option.setName("choice_8").setDescription("Choice 8"),
        )
        .addStringOption((option) =>
          option.setName("choice_9").setDescription("Choice 9"),
        )
        .addStringOption((option) =>
          option.setName("choice_10").setDescription("Choice 10"),
        ),
    );

    builder.addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List recent polls in this channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to scan for polls")
            .addChannelTypes(ChannelType.GuildText),
        ),
    );

    builder.addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a poll by message ID")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("Message ID of the poll to end")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel containing the poll")
            .addChannelTypes(ChannelType.GuildText),
        ),
    );

    builder.addSubcommand((sub) =>
      sub
        .setName("about")
        .setDescription("Learn what polls are and how to run them"),
    );
  },
  config: Config.utility(3),
  execute: ExecutePoll,
});
