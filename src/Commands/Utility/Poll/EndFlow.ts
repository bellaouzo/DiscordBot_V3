import { ChatInputCommandInteraction, MessageFlags, TextChannel } from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory, IsModerator, ResolveInteractionMember } from "@utilities";
import {
  ExtractPoll,
  GetPollStatus,
  IsGuildTextChannel,
} from "@commands/Utility/Poll/PollShared";

export async function HandleEndPoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const selectedChannel = interaction.options.getChannel("channel");
  const channel =
    selectedChannel && IsGuildTextChannel(selectedChannel)
      ? selectedChannel
      : IsGuildTextChannel(interaction.channel)
        ? (interaction.channel as TextChannel)
        : null;

  if (!interaction.guild || !channel) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Text Channel Only",
      description: "Polls can only be ended inside a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
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

  const poll = ExtractPoll(pollMessage);

  if (!poll) {
    const embed = EmbedFactory.CreateError({
      title: "Not A Poll",
      description: "The specified message does not contain a poll.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);
  const isPollAuthor = pollMessage.author.id === interaction.user.id;
  const isStaff = IsModerator(member, settings);
  if (!isPollAuthor && !isStaff) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "Only the poll creator or a moderator can end this poll.",
    });
    await interaction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const { isEnded } = GetPollStatus(poll, pollMessage.createdTimestamp);

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
