import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory, ToActionRowData, ToEmbedData } from "@utilities";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import { RegisterGiveawayEntryHandler } from "@systems/Giveaway/GiveawayEntryHandler";
import { ParseDuration } from "@utilities/Duration";
import {
  GuildTextChannel,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  RequireModerator,
} from "@commands/Utility/Giveaway/GiveawayShared";

export async function HandleCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  if (!(await RequireModerator(interaction, context))) {
    return;
  }

  const { interactionResponder } = context.responders;

  if (!interaction.guild || !interaction.channel?.isTextBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Giveaways can only be created in server text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const prize = interaction.options.getString("prize", true);
  const durationStr = interaction.options.getString("duration", true);
  const winnerCount = interaction.options.getInteger("winners") ?? 1;

  const durationMs = ParseDuration(durationStr);
  const durationMinutes = durationMs ? durationMs / 60000 : null;

  if (
    !durationMinutes ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Duration",
      description: `Duration must be between 1 minute and 7 days. Examples: \`30m\`, \`2h\`, \`1d\``,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interactionResponder.Defer(interaction, true);

  const manager = new GiveawayManager(
    interaction.guild.id,
    context.databases.userDb,
  );
  const endsAt = Date.now() + durationMs!;

  const { embed, row, customId } = manager.CreateGiveawayMessage({
    prize,
    endsAt,
    winnerCount,
    hostId: interaction.user.id,
    entryCount: 0,
  });

  const channel = interaction.channel as GuildTextChannel;
  const giveawayMessage = await channel.send({
    embeds: [ToEmbedData(embed)],
    components: [ToActionRowData(row)],
  });

  manager.SaveGiveaway({
    channelId: channel.id,
    messageId: giveawayMessage.id,
    hostId: interaction.user.id,
    prize,
    winnerCount,
    endsAt,
  });

  RegisterGiveawayEntryHandler({
    customId,
    expiresInMs: endsAt - Date.now() + 60000,
    manager,
    channel,
    giveawayMessageId: giveawayMessage.id,
    context,
  });

  const confirmEmbed = EmbedFactory.CreateSuccess({
    title: "Giveaway Created",
    description: [
      `**Prize:** ${prize}`,
      `**Winners:** ${winnerCount}`,
      `**Duration:** ${durationStr}`,
      `**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
      ``,
      `[Jump to Giveaway](${giveawayMessage.url})`,
    ].join("\n"),
  });

  await interactionResponder.Edit(interaction, {
    embeds: [ToEmbedData(confirmEmbed)],
  });
}
