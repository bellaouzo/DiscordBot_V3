import type { Client, TextChannel } from "discord.js";
import type { UserDatabase } from "@database";
import type { ServerDatabase } from "@database/ServerDatabase";
import type { Logger } from "@shared/Logger";
import { PollingScheduler } from "@shared/PollingScheduler";
import { IsFeatureEnabled } from "@shared/Features";
import { LotteryManager } from "@systems/Economy/LotteryManager";

const POLL_INTERVAL_MS = 30_000;

export class LotteryScheduler extends PollingScheduler {
  constructor(
    private readonly client: Client,
    private readonly userDb: UserDatabase,
    private readonly serverDb: ServerDatabase,
    private readonly logger: Logger,
  ) {
    super({
      name: "LotteryScheduler",
      intervalMs: POLL_INTERVAL_MS,
      logger,
      failureMessage: "Error processing ended lotteries",
    });
  }

  protected async Poll(): Promise<void> {
    const ended = this.userDb.GetEndedLotteriesToProcess();

    for (const lottery of ended) {
      if (!IsFeatureEnabled(this.serverDb, lottery.guild_id, "economy")) {
        continue;
      }
      await this.ProcessLottery(lottery.guild_id, lottery.message_id);
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
