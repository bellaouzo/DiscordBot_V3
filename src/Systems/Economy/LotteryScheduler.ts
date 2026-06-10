import type { Client, TextChannel } from "discord.js";
import type { UserDatabase } from "@database";
import type { Logger } from "@shared/Logger";
import { LotteryManager } from "@systems/Economy/LotteryManager";

const POLL_INTERVAL_MS = 30_000;

export class LotteryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly client: Client,
    private readonly userDb: UserDatabase,
    private readonly logger: Logger,
  ) {}

  Start(): void {
    if (this.intervalId) {
      this.logger.Warn("LotteryScheduler already running");
      return;
    }

    this.intervalId = setInterval(() => {
      void this.ProcessEndedLotteries();
    }, POLL_INTERVAL_MS);

    void this.ProcessEndedLotteries();
  }

  Stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async ProcessEndedLotteries(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const ended = this.userDb.GetEndedLotteriesToProcess();

      for (const lottery of ended) {
        await this.ProcessLottery(lottery.guild_id, lottery.message_id);
      }
    } catch (error) {
      this.logger.Error("Error processing ended lotteries", { error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async ProcessLottery(
    guildId: string,
    messageId: string,
  ): Promise<void> {
    try {
      const manager = new LotteryManager(guildId, this.userDb);
      const lottery = manager.GetLottery(messageId);

      if (!lottery || lottery.ended) {
        return;
      }

      try {
        const guild = await this.client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(lottery.channel_id);

        if (channel?.isTextBased()) {
          await manager.FinalizeLottery(lottery, channel as TextChannel);
        } else {
          await manager.FinalizeLottery(lottery);
        }
      } catch (messageError) {
        this.logger.Warn("Could not finalize lottery message", {
          extra: { messageId },
          error: messageError,
        });
        await manager.FinalizeLottery(lottery);
      }
    } catch (error) {
      this.logger.Error("Error processing lottery", {
        extra: { messageId },
        error,
      });
    }
  }
}
