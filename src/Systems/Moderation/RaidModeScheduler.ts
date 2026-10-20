import type {
  Client,
  OverwriteResolvable,
  OverwriteType,
  TextChannel,
} from "discord.js";
import type { ModerationDatabase, RaidMode } from "@database";
import type { Logger } from "@shared/Logger";
import { PollingScheduler } from "@shared/PollingScheduler";
import { SafeParseJson } from "@utilities/SafeJson";

const RAID_SWEEP_INTERVAL_MS = 10_000;

type StoredOverwrite = {
  id: string;
  allow: string;
  deny: string;
  type: OverwriteType;
};

function isStoredOverwriteArray(data: unknown): data is StoredOverwrite[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "allow" in item &&
      "deny" in item &&
      "type" in item,
  );
}

function DeserializeOverwrites(serialized: string): OverwriteResolvable[] {
  const result = SafeParseJson(serialized, isStoredOverwriteArray);
  if (!result.success || !result.data) {
    return [];
  }
  return result.data.map((entry) => ({
    id: entry.id,
    allow: BigInt(entry.allow),
    deny: BigInt(entry.deny),
    type: entry.type,
  }));
}

interface RaidModeSchedulerOptions {
  readonly client: Client;
  readonly db: ModerationDatabase;
  readonly logger: Logger;
}

export class RaidModeScheduler extends PollingScheduler {
  constructor(private readonly options: RaidModeSchedulerOptions) {
    super({
      name: "RaidModeScheduler",
      intervalMs: RAID_SWEEP_INTERVAL_MS,
      logger: options.logger,
      failureMessage: "Failed to process raid modes",
    });
  }

  protected async Poll(): Promise<void> {
    const expired = this.options.db.ListExpiredRaidModes(Date.now());
    for (const raid of expired) {
      await this.RestoreRaidMode(raid);
    }
  }

  private async RestoreRaidMode(raid: RaidMode): Promise<void> {
    const { db, client, logger } = this.options;

    const guild = await client.guilds.fetch(raid.guild_id).catch(() => null);
    if (!guild) {
      db.MarkRaidModeCleared(raid.id);
      db.ClearRaidModeChannelStates(raid.id);
      return;
    }

    const states = db.ListRaidModeChannelStates(raid.id);
    for (const state of states) {
      const channel = guild.channels.cache.get(state.channel_id) as
        | TextChannel
        | undefined;
      if (!channel || !channel.manageable) {
        continue;
      }

      try {
        const overwrites = DeserializeOverwrites(state.overwrites);
        await channel.permissionOverwrites.set(overwrites);
        await channel.setRateLimitPerUser(
          state.rate_limit_per_user,
          "Raid mode expired",
        );
      } catch (error) {
        logger.Warn("Failed to restore raid channel state", {
          error,
          guildId: guild.id,
          extra: { channelId: state.channel_id },
        });
      }
    }

    db.MarkRaidModeCleared(raid.id);
    db.ClearRaidModeChannelStates(raid.id);
  }
}
