import {
  ChatInputCommandInteraction,
  Guild,
  TextChannel,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory } from "@utilities";
import { RaidModeChannelState } from "@database";
import { ParseOverwrites } from "@commands/Moderation/shared/OverwriteSerialization";

export async function RestoreChannelStates(
  guild: Guild | null,
  channels: RaidModeChannelState[],
  context: CommandContext,
): Promise<void> {
  if (!guild) {
    return;
  }

  for (const state of channels) {
    const channel = guild.channels.cache.get(state.channel_id) as
      | TextChannel
      | undefined;
    if (!channel || !channel.manageable) {
      continue;
    }

    try {
      const overwrites = ParseOverwrites(state.overwrites);
      await channel.permissionOverwrites.set(overwrites);
      await channel.setRateLimitPerUser(
        state.rate_limit_per_user,
        "Raid mode ended",
      );
    } catch (error) {
      context.logger.Warn("Failed to restore channel state", {
        error,
        guildId: guild.id,
        extra: { channelId: state.channel_id },
      });
    }
  }
}

export async function HandleDeactivateRaidMode(
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
        description: "Raid mode is not currently active.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channelStates = db.ListRaidModeChannelStates(active.id);
    await RestoreChannelStates(guild, channelStates, context);
    db.MarkRaidModeCleared(active.id);
    db.ClearRaidModeChannelStates(active.id);

    const embed = EmbedFactory.CreateSuccess({
      title: "Raid Mode Disabled",
      description: "Restored channel permissions and slowmode.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to disable raid mode", { error });
    const embed = EmbedFactory.CreateError({
      title: "Disable Failed",
      description: "Could not disable raid mode.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
