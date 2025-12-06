import { Client } from "discord.js";
import { ModerationDatabase, TempAction } from "@database";
import { Logger } from "@shared/Logger";

const SWEEP_INTERVAL_MS = 30_000;

export interface TempActionSchedulerOptions {
  readonly client: Client;
  readonly db: ModerationDatabase;
  readonly logger: Logger;
}

export class TempActionScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly options: TempActionSchedulerOptions) {}

  Start(): void {
    if (this.interval) {
      return;
    }

    this.RunSweep();
    this.interval = setInterval(() => this.RunSweep(), SWEEP_INTERVAL_MS);
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
    const { logger, db } = this.options;

    try {
      const now = Date.now();
      const pending = db.GetPendingTempActions({ before: now });

      for (const action of pending) {
        const processed = await this.ProcessAction(action);
        if (processed) {
          db.MarkTempActionProcessed(action.id);
        }
      }
    } catch (error) {
      logger.Error("Failed to process temp actions", { error });
    } finally {
      this.isRunning = false;
    }
  }

  private async ProcessAction(action: TempAction): Promise<boolean> {
    const guild = await this.FetchGuild(action.guild_id);
    if (!guild) {
      // Bot likely removed; stop retrying this entry
      return true;
    }

    if (action.action === "ban") {
      try {
        const existingBan = await guild.bans
          .fetch(action.user_id)
          .catch(() => null);
        if (!existingBan) {
          return true;
        }

        await guild.bans.remove(action.user_id, "Temporary ban expired");
        return true;
      } catch (error) {
        this.options.logger.Warn("Failed to remove temp ban", {
          error,
          guildId: guild.id,
          targetUserId: action.user_id,
        });
        return false;
      }
    }

    // Mute handling
    try {
      const member = await guild.members
        .fetch(action.user_id)
        .catch(() => null);
      if (!member) {
        return true;
      }

      if (!member.communicationDisabledUntilTimestamp) {
        return true;
      }

      await member.timeout(null, "Temporary mute expired");
      return true;
    } catch (error) {
      this.options.logger.Warn("Failed to clear temp mute", {
        error,
        guildId: guild.id,
        targetUserId: action.user_id,
      });
      return false;
    }
  }

  private async FetchGuild(guildId: string) {
    try {
      return await this.options.client.guilds.fetch(guildId);
    } catch (error) {
      this.options.logger.Warn("Failed to fetch guild for temp action", {
        error,
        guildId,
      });
      return null;
    }
  }
}
