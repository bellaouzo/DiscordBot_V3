import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "@middleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 10080; // 7 days

async function ExecutePoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (
    !interaction.guild ||
    interaction.channel?.type !== ChannelType.GuildText
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Text Channel Only",
      description: "Polls can only be created in a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const question = interaction.options.getString("question", true);
  const durationMinutesRaw =
    interaction.options.getInteger("duration_minutes") ?? 60;

  const durationMinutes = Math.min(
    Math.max(durationMinutesRaw, MIN_DURATION_MINUTES),
    MAX_DURATION_MINUTES
  );

  const choices: string[] = [];
  for (let index = 1; index <= 10; index++) {
    const value = interaction.options.getString(`choice_${index}`, index <= 2);
    if (value) {
      choices.push(value);
    }
  }

  if (choices.length < 2) {
    const embed = EmbedFactory.CreateError({
      title: "Need More Choices",
      description: "Please provide at least two choices for the poll.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const answers = choices.slice(0, 10).map((text) => ({ text }));

  const channel = interaction.channel as TextChannel;
  const pollMessage = await channel.send({
    poll: {
      question: { text: question },
      answers,
      allowMultiselect: false,
      duration: durationMinutes,
    },
  });

  await interaction.editReply({
    content: `Poll created: ${pollMessage.url}`,
  });
}

export const PollCommand = CreateCommand({
  name: "poll",
  description: "Create a native Discord poll",
  group: "utility",
  configure: (builder) => {
    builder
      .addStringOption((option) =>
        option
          .setName("question")
          .setDescription("Question to ask")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("choice_1").setDescription("Choice 1").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("choice_2").setDescription("Choice 2").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("duration_minutes")
          .setDescription("How long the poll should run (minutes)")
          .setRequired(false)
          .setMinValue(MIN_DURATION_MINUTES)
          .setMaxValue(MAX_DURATION_MINUTES)
      );

    for (let index = 3; index <= 10; index++) {
      builder.addStringOption((option) => {
        const opt = option
          .setName(`choice_${index}`)
          .setDescription(`Choice ${index}`);
        return opt;
      });
    }
  },
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  execute: ExecutePoll,
});
