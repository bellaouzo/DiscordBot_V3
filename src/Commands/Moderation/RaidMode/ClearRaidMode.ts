import type { Client, TextChannel } from "discord.js";
import type { Logger } from "@shared/Logger";
import { ModerationDatabase } from "@database";
import { ParseOverwrites } from "@commands/Moderation/shared/OverwriteSerialization";

export async function ClearRaidModeByGuild(
  guildId: string,
  client: Client,
  logger: Logger,
): Promise<boolean> {
  const db = new ModerationDatabase(logger.Child({ phase: "raid-clear" }));
  const active = db.GetActiveRaidMode(guildId);
  if (!active) {
    return false;
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    db.MarkRaidModeCleared(active.id);
    db.ClearRaidModeChannelStates(active.id);
    return true;
  }

  const states = db.ListRaidModeChannelStates(active.id);
  for (const state of states) {
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
        "Raid mode expired",
      );
    } catch (error) {
      logger.Warn("Failed to restore raid channel state (auto-clear)", {
        error,
        guildId: guild.id,
        extra: { channelId: state.channel_id },
      });
    }
  }

  db.MarkRaidModeCleared(active.id);
  db.ClearRaidModeChannelStates(active.id);
  return true;
}
