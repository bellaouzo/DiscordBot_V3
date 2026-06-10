import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild, EmbedFactory, ToEmbedData } from "@utilities";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";

export async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const manager = new GiveawayManager(
    RequireGuild(interaction).id,
    context.databases.userDb,
  );
  const activeGiveaways = manager.GetActiveGiveaways();

  if (activeGiveaways.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Active Giveaways",
      description: "There are no active giveaways in this server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = activeGiveaways.map((g, i) => {
    const endsAt = Math.floor(g.ends_at / 1000);
    const entries = manager.GetEntryCount(g.id);
    return `**${i + 1}.** ${g.prize}\n   Ends <t:${endsAt}:R> • ${entries} entries • ID: \`${g.message_id}\``;
  });

  const embed = EmbedFactory.Create({
    title: "🎉 Active Giveaways",
    description: lines.join("\n\n"),
    footer: `${activeGiveaways.length} active giveaway${activeGiveaways.length !== 1 ? "s" : ""}`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [ToEmbedData(embed)],
    flags: MessageFlags.Ephemeral,
  });
}
