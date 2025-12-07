import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  Message,
  TextChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "@middleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { PaginationPage } from "@shared/Paginator";

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 10080; // 7 days
const LIST_FETCH_LIMIT = 50;
const LIST_PAGE_SIZE = 6;

interface NativePollResults {
  isFinalized?: boolean;
  finalized?: boolean;
}

interface NativePoll {
  question?: { text?: string };
  answers?: Array<{ text?: string }>;
  allowMultiselect?: boolean;
  duration?: number | null;
  expiresTimestamp?: number | null;
  expiresAt?: Date | null;
  results?: NativePollResults;
  resultsFinalized?: boolean;
  end?: () => Promise<void>;
  terminate?: () => Promise<void>;
  isFinalized?: boolean;
  ended?: boolean;
}

function _IsGuildTextChannel(channel: unknown): channel is TextChannel {
  return (
    Boolean(channel) && (channel as TextChannel).type === ChannelType.GuildText
  );
}

function _ExtractPoll(message: unknown): NativePoll | undefined {
  return (message as { poll?: NativePoll }).poll;
}

function _GetPollStatus(
  poll: NativePoll | undefined,
  createdTimestamp: number
): { isEnded: boolean; endsAt?: number } {
  const endsAt = (() => {
    if (typeof poll?.expiresTimestamp === "number") {
      return poll.expiresTimestamp;
    }
    if (poll?.expiresAt instanceof Date) {
      return poll.expiresAt.getTime();
    }
    if (typeof poll?.duration === "number") {
      return createdTimestamp + poll.duration * 60 * 1000;
    }
    return undefined;
  })();

  const finalized =
    poll?.resultsFinalized ||
    poll?.results?.isFinalized ||
    poll?.results?.finalized ||
    poll?.isFinalized ||
    poll?.ended;

  const isEnded = Boolean(finalized || (endsAt ? Date.now() >= endsAt : false));

  return { isEnded, endsAt };
}

async function ExecutePoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false) ?? "create";

  if (subcommand === "list") {
    await ExecuteListPolls(interaction, context);
    return;
  }

  if (subcommand === "end") {
    await ExecuteEndPoll(interaction, context);
    return;
  }

  await ExecuteCreatePoll(interaction, context);
}

async function ExecuteCreatePoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild || !_IsGuildTextChannel(interaction.channel)) {
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

async function ExecuteListPolls(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;

  const selectedChannel = interaction.options.getChannel("channel");
  const channel =
    selectedChannel && _IsGuildTextChannel(selectedChannel)
      ? selectedChannel
      : _IsGuildTextChannel(interaction.channel)
        ? (interaction.channel as TextChannel)
        : null;

  if (!interaction.guild || !channel) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Text Channel Only",
      description: "Polls can only be listed inside a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const messages = await channel.messages.fetch({ limit: LIST_FETCH_LIMIT });
  const pollMessages = messages
    .filter((message) => Boolean(_ExtractPoll(message)))
    .sort((first, second) => second.createdTimestamp - first.createdTimestamp);

  if (pollMessages.size === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Polls Found",
      description: `No polls were found in #${channel.name}.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const pages = BuildPollPages(Array.from(pollMessages.values()), channel);

  await paginatedResponder.Send({
    interaction,
    pages,
    ephemeral: true,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

async function ExecuteEndPoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const selectedChannel = interaction.options.getChannel("channel");
  const channel =
    selectedChannel && _IsGuildTextChannel(selectedChannel)
      ? selectedChannel
      : _IsGuildTextChannel(interaction.channel)
        ? (interaction.channel as TextChannel)
        : null;

  if (!interaction.guild || !channel) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Text Channel Only",
      description: "Polls can only be ended inside a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let pollMessage;
  try {
    pollMessage = await channel.messages.fetch(messageId);
  } catch {
    const embed = EmbedFactory.CreateError({
      title: "Poll Not Found",
      description:
        "Could not find a poll with that message ID in this channel.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const poll = _ExtractPoll(pollMessage);

  if (!poll) {
    const embed = EmbedFactory.CreateError({
      title: "Not A Poll",
      description: "The specified message does not contain a poll.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const { isEnded } = _GetPollStatus(poll, pollMessage.createdTimestamp);

  if (isEnded) {
    const embed = EmbedFactory.CreateWarning({
      title: "Poll Already Ended",
      description: "That poll is already closed.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  if (typeof poll.end === "function") {
    await poll.end();
  } else if (typeof poll.terminate === "function") {
    await poll.terminate();
  } else {
    const embed = EmbedFactory.CreateError({
      title: "Unsupported Action",
      description: "This poll cannot be ended by the bot.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Poll Ended",
    description: `Poll has been ended. [View poll](${pollMessage.url})`,
  });
  await interaction.editReply({ embeds: [embed.toJSON()] });
}

function BuildPollPages(
  polls: Array<Message<true>>,
  channel: TextChannel
): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < polls.length; index += LIST_PAGE_SIZE) {
    const slice = polls.slice(index, index + LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: `Polls in #${channel.name}`,
      description: `Showing polls ${start} - ${end} of ${polls.length}`,
    });

    slice.forEach((pollMessage, sliceIndex) => {
      const poll = _ExtractPoll(pollMessage);
      const question = poll?.question?.text ?? "Untitled poll";
      const { isEnded, endsAt } = _GetPollStatus(
        poll,
        pollMessage.createdTimestamp
      );
      const status = isEnded ? "Ended" : "Active";
      const endText = endsAt
        ? isEnded
          ? ` — ended <t:${Math.floor(endsAt / 1000)}:R>`
          : ` — ends <t:${Math.floor(endsAt / 1000)}:R>`
        : "";

      embed.addFields({
        name: `${start + sliceIndex}. ${question}`,
        value: `${status}${endText}\nMessage ID: ${pollMessage.id}\n[Jump to poll](${pollMessage.url})`,
        inline: false,
      });
    });

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
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
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("choice_1")
            .setDescription("Choice 1")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("choice_2")
            .setDescription("Choice 2")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("duration_minutes")
            .setDescription("How long the poll should run (minutes)")
            .setRequired(false)
            .setMinValue(MIN_DURATION_MINUTES)
            .setMaxValue(MAX_DURATION_MINUTES)
        )
        .addStringOption((option) =>
          option.setName("choice_3").setDescription("Choice 3")
        )
        .addStringOption((option) =>
          option.setName("choice_4").setDescription("Choice 4")
        )
        .addStringOption((option) =>
          option.setName("choice_5").setDescription("Choice 5")
        )
        .addStringOption((option) =>
          option.setName("choice_6").setDescription("Choice 6")
        )
        .addStringOption((option) =>
          option.setName("choice_7").setDescription("Choice 7")
        )
        .addStringOption((option) =>
          option.setName("choice_8").setDescription("Choice 8")
        )
        .addStringOption((option) =>
          option.setName("choice_9").setDescription("Choice 9")
        )
        .addStringOption((option) =>
          option.setName("choice_10").setDescription("Choice 10")
        )
    );

    builder.addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List recent polls in this channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to scan for polls")
            .addChannelTypes(ChannelType.GuildText)
        )
    );

    builder.addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a poll by message ID")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("Message ID of the poll to end")
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel containing the poll")
            .addChannelTypes(ChannelType.GuildText)
        )
    );
  },
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  execute: ExecutePoll,
});
