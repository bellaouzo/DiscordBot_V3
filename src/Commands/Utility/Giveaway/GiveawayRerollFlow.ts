import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, TextChannel } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild, EmbedFactory, ToEmbedData } from "@utilities";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import { CanManageGiveaway } from "@commands/Utility/Giveaway/GiveawayShared";

export async function HandleReroll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const messageId = interaction.options.getString("message_id", true);
  const manager = new GiveawayManager(
    RequireGuild(interaction).id,
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
        "Only the giveaway host or a moderator can reroll this giveaway.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!giveaway.ended) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Ended",
      description: "This giveaway hasn't ended yet. Use `/giveaway end` first.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newWinners = manager.SelectWinners(giveaway.id, giveaway.winner_count);
  manager.EndGiveaway(messageId, newWinners);

  try {
    const channel = await interaction.guild?.channels.fetch(
      giveaway.channel_id,
    );
    if (channel instanceof TextChannel) {
      const mentions =
        newWinners.length > 0
          ? newWinners.map((id) => `<@${id}>`).join(", ")
          : "No valid entries";

      await channel.send({
        content: `🔄 Giveaway rerolled! New winner${newWinners.length !== 1 ? "s" : ""}: ${mentions} for **${giveaway.prize}**!`,
      });
    }
  } catch {
    void 0;
  }

  const winnerMentions =
    newWinners.length > 0
      ? newWinners.map((id) => `<@${id}>`).join(", ")
      : "No winners";
  const embed = EmbedFactory.CreateSuccess({
    title: "Giveaway Rerolled",
    description: [
      `**Prize:** ${giveaway.prize}`,
      `**New Winners:** ${winnerMentions}`,
    ].join("\n"),
  });

  await interactionResponder.Reply(interaction, {
    embeds: [ToEmbedData(embed)],
    flags: MessageFlags.Ephemeral,
  });
}
