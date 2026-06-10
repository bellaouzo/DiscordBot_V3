import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EmbedFactory, AppendFeatureGuideHint } from "@utilities";
import { ClearRaidModeByGuild } from "@commands/Moderation/RaidMode/ClearRaidMode";

export async function HandleRaidModeStatus(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const db = context.databases.moderationDb;
  try {
    const active = db.GetActiveRaidMode(guild.id);
    if (!active) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Active",
        description: "Raid mode is not active.",
      });
      AppendFeatureGuideHint(embed, "raidmode");
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const now = Date.now();
    if (active.expires_at && active.expires_at <= now) {
      await ClearRaidModeByGuild(guild.id, interaction.client, context.logger);
      const embed = EmbedFactory.CreateSuccess({
        title: "Raid Mode Cleared",
        description: "Raid mode had expired and was cleared automatically.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = EmbedFactory.Create({
      title: "🛡️ Raid Mode Status",
      description: "Raid mode is active.",
    });

    const expiresText = active.expires_at
      ? `<t:${Math.floor(active.expires_at / 1000)}:R>`
      : "No expiry";

    embed.addFields(
      { name: "Slowmode", value: `${active.slowmode_seconds}s`, inline: true },
      { name: "Expires", value: expiresText, inline: true },
      { name: "Applied By", value: `<@${active.applied_by}>`, inline: true },
    );
    AppendFeatureGuideHint(embed, "raidmode");

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to show raid mode status", { error });
    const embed = EmbedFactory.CreateError({
      title: "Status Failed",
      description: "Could not fetch raid mode status.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
