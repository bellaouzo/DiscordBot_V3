import { ChatInputCommandInteraction, MessageFlags, TextChannel } from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory, IsModerator, ResolveInteractionMember } from "@utilities";
import {
  IsGuildTextChannel,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@commands/Utility/Poll/PollShared";

export async function HandleCreatePoll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild || !IsGuildTextChannel(interaction.channel)) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Text Channel Only",
      description: "Polls can only be created in a server text channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);
  if (!IsModerator(member, settings)) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "Only moderators can create polls.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const question = interaction.options.getString("question", true);
  const durationMinutesRaw =
    interaction.options.getInteger("duration_minutes") ?? 60;

  const durationMinutes = Math.min(
    Math.max(durationMinutesRaw, MIN_DURATION_MINUTES),
    MAX_DURATION_MINUTES,
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
      flags: MessageFlags.Ephemeral,
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
