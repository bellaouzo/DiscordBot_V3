import {
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";

const MAX_SLOWMODE = 21600; // 6 hours

function ResolveChannel(
  interaction: ChatInputCommandInteraction
): TextChannel | null {
  const provided = interaction.options.getChannel("channel");
  const target =
    (provided as TextChannel | null) ??
    (interaction.channel?.isTextBased()
      ? (interaction.channel as TextChannel)
      : null);

  if (!target || typeof target.setRateLimitPerUser !== "function") {
    return null;
  }

  return target;
}

async function ExecuteSlowmode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const seconds = interaction.options.getInteger("seconds", true);
  if (seconds < 0 || seconds > MAX_SLOWMODE) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Slowmode",
      description: `Slowmode must be between 0 and ${MAX_SLOWMODE} seconds.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const channel = ResolveChannel(interaction);
  if (!channel) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Select a text channel to update slowmode.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const reason =
    interaction.options.getString("reason") ?? `Set by ${interaction.user.tag}`;

  await channel.setRateLimitPerUser(seconds, reason);

  const embed = EmbedFactory.CreateSuccess({
    title: "Slowmode Updated",
    description:
      seconds === 0
        ? `Disabled slowmode in ${channel}.`
        : `Set slowmode to **${seconds}s** in ${channel}.`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const SlowmodeCommand = CreateCommand({
  name: "slowmode",
  description: "Set or disable slowmode for a channel",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteSlowmode,
  configure: (builder) => {
    builder
      .addIntegerOption((option) =>
        option
          .setName("seconds")
          .setDescription("Slowmode duration in seconds (0 to disable)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(MAX_SLOWMODE)
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel to update (defaults to current)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for audit log")
          .setRequired(false)
      );
  },
});
