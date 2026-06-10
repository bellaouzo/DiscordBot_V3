import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EmbedFactory } from "@utilities";
import {
  BuildPollPages,
  ExtractPoll,
  IsGuildTextChannel,
  LIST_FETCH_LIMIT,
} from "@commands/Utility/Poll/PollShared";

export async function HandleListPolls(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;

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
      description: "Polls can only be listed inside a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const messages = await channel.messages.fetch({ limit: LIST_FETCH_LIMIT });
  const pollMessages = messages
    .filter((message) => Boolean(ExtractPoll(message)))
    .sort((first, second) => second.createdTimestamp - first.createdTimestamp);

  if (pollMessages.size === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Polls Found",
      description: `No polls were found in #${channel.name}.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pages = BuildPollPages(Array.from(pollMessages.values()), channel);

  await paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}
