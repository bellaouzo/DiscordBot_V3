import {
  Client,
  OverwriteResolvable,
  OverwriteType,
  TextChannel,
} from "discord.js";
import { ModerationDatabase, RaidMode } from "@database";
import { Logger } from "@shared/Logger";
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
      "type" in item
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

export class RaidModeScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly options: RaidModeSchedulerOptions) {}

  Start(): void {
    if (this.interval) {
      return;
    }

    this.RunSweep();
    this.interval = setInterval(() => this.RunSweep(), RAID_SWEEP_INTERVAL_MS);
  }

  Stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async RunSweep(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const { db, logger } = this.options;
    try {
      const now = Date.now();
      const expired = db.ListExpiredRaidModes(now);
      for (const raid of expired) {
        await this.RestoreRaidMode(raid);
      }
    } catch (error) {
      logger.Error("Failed to process raid modes", { error });
    } finally {
      this.isRunning = false;
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
          "Raid mode expired"
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
