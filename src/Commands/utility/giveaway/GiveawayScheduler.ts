import { Client, TextChannel } from "discord.js";
import { UserDatabase } from "@database";
import { Logger } from "@shared/Logger";
import { GiveawayManager } from "./GiveawayManager";

const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds

export class GiveawayScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly client: Client,
    private readonly userDb: UserDatabase,
    private readonly logger: Logger
  ) {}

  Start(): void {
    if (this.intervalId) {
      this.logger.Warn("GiveawayScheduler already running");
      return;
    }

    this.intervalId = setInterval(() => {
      void this.ProcessEndedGiveaways();
    }, POLL_INTERVAL_MS);

    // Run immediately on start
    void this.ProcessEndedGiveaways();
  }

  Stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async ProcessEndedGiveaways(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const endedGiveaways = this.userDb.GetEndedGiveawaysToProcess();

      for (const giveaway of endedGiveaways) {
        await this.ProcessGiveaway(giveaway.message_id, giveaway.guild_id);
      }
    } catch (error) {
      this.logger.Error("Error processing ended giveaways", { error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async ProcessGiveaway(
    messageId: string,
    guildId: string
  ): Promise<void> {
    try {
      const manager = new GiveawayManager(guildId, this.userDb);
      const giveaway = manager.GetGiveaway(messageId);

      if (!giveaway || giveaway.ended) {
        return;
      }

      try {
        const guild = await this.client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(giveaway.channel_id);

        if (channel?.isTextBased()) {
          await manager.FinalizeGiveaway(giveaway, channel as TextChannel);
        } else {
          await manager.FinalizeGiveaway(giveaway);
        }
      } catch (messageError) {
        this.logger.Warn("Could not update giveaway message", {
          extra: { messageId },
          error: messageError,
        });
      }
    } catch (error) {
      this.logger.Error("Error processing giveaway", {
        extra: { messageId },
        error,
      });
    }
  }
}
