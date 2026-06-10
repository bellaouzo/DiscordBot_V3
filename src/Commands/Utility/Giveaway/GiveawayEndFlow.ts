import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory, ToEmbedData } from "@utilities";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import {
  CanManageGiveaway,
  GuildTextChannel,
} from "@commands/Utility/Giveaway/GiveawayShared";

export async function HandleEnd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const messageId = interaction.options.getString("message_id", true);
  const manager = new GiveawayManager(
    interaction.guild!.id,
    context.databases.userDb,
  );
  const giveaway = manager.GetGiveaway(messageId);

  if (!giveaway) {
    const embed = EmbedFactory.CreateError({
      title: "Giveaway Not Found",
      description: "No giveaway found with that message ID.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await CanManageGiveaway(interaction, giveaway.host_id, context))) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description:
        "Only the giveaway host or a moderator can end this giveaway.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (giveaway.ended) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Ended",
      description: "This giveaway has already ended.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interactionResponder.Defer(interaction, true);

  const channel = await interaction.guild!.channels.fetch(giveaway.channel_id);
  const guildChannel =
    channel && channel.isTextBased()
      ? (channel as GuildTextChannel)
      : undefined;

  const { winners, entryCount } = await manager.FinalizeGiveaway(
    giveaway,
    guildChannel,
  );

  const winnerMentions =
    winners.length > 0
      ? winners.map((id) => `<@${id}>`).join(", ")
      : "No winners";
  const embed = EmbedFactory.CreateSuccess({
    title: "Giveaway Ended",
    description: [
      `**Prize:** ${giveaway.prize}`,
      `**Winners:** ${winnerMentions}`,
      `**Total Entries:** ${entryCount}`,
    ].join("\n"),
  });

  await interactionResponder.Edit(interaction, {
    embeds: [ToEmbedData(embed)],
  });
}
