import type { Client } from "discord.js";
import type { ModerationDatabase, TempAction } from "@database";
import type { Logger } from "@shared/Logger";
import { PollingScheduler } from "@shared/PollingScheduler";

const SWEEP_INTERVAL_MS = 30_000;

export interface TempActionSchedulerOptions {
  readonly client: Client;
  readonly db: ModerationDatabase;
  readonly logger: Logger;
}

export class TempActionScheduler extends PollingScheduler {
  constructor(private readonly options: TempActionSchedulerOptions) {
    super({
      name: "TempActionScheduler",
      intervalMs: SWEEP_INTERVAL_MS,
      logger: options.logger,
      failureMessage: "Failed to process temp actions",
    });
  }

  protected async Poll(): Promise<void> {
    const { db } = this.options;
    const pending = db.GetPendingTempActions({ before: Date.now() });

    for (const action of pending) {
      const processed = await this.ProcessAction(action);
      if (processed) {
        db.MarkTempActionProcessed(action.id);
      }
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
