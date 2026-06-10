import type { TextChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { UserDatabase } from "@database";
import type { EconomyLottery } from "@database/User/Stores/LotteryStore";
import { EmbedFactory } from "@utilities";
import { EconomyManager } from "@systems/Economy/EconomyManager";

export class LotteryManager {
  constructor(
    private readonly guildId: string,
    private readonly userDb: UserDatabase,
  ) {}

  CreateLotteryMessage(data: {
    entryCost: number;
    endsAt: number;
    hostId: string;
    pot: number;
    entryCount: number;
    lotteryId: number;
  }) {
    const embed = EmbedFactory.Create({
      title: "🎟️ Server Lottery",
      description: [
        `**Entry Cost:** ${data.entryCost} coins`,
        `**Current Pot:** ${data.pot} coins`,
        `**Ends:** <t:${Math.floor(data.endsAt / 1000)}:R>`,
        `**Hosted by:** <@${data.hostId}>`,
        ``,
        `Click below to enter!`,
      ].join("\n"),
      color: 0x9b59b6,
      footer: `${data.entryCount} entries`,
    });

    const button = new ButtonBuilder()
      .setCustomId(`lottery_enter_${data.lotteryId}`)
      .setLabel("Enter Lottery")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    return { embed, row };
  }

  CreateEndedEmbed(data: {
    entryCost: number;
    pot: number;
    winnerId: string | null;
    hostId: string;
    entryCount: number;
  }) {
    const winnerText = data.winnerId
      ? `<@${data.winnerId}> won **${data.pot}** coins!`
      : "No entries — lottery ended with no winner.";

    return EmbedFactory.Create({
      title: "🎟️ Lottery Ended",
      description: [
        `**Entry Cost:** ${data.entryCost} coins`,
        `**Final Pot:** ${data.pot} coins`,
        `**Result:** ${winnerText}`,
        `**Hosted by:** <@${data.hostId}>`,
      ].join("\n"),
      color: 0x2ecc71,
      footer: `${data.entryCount} entries`,
    });
  }

  GetLottery(messageId: string): EconomyLottery | null {
    return this.userDb.GetLotteryByMessageId(messageId);
  }

  async FinalizeLottery(
    lottery: EconomyLottery,
    channel?: TextChannel,
  ): Promise<{ winnerId: string | null; entryCount: number }> {
    const entries = this.userDb.GetLotteryEntries(lottery.id);
    const winnerId =
      entries.length > 0
        ? entries[Math.floor(Math.random() * entries.length)]
        : null;

    this.userDb.EndLottery(lottery.id, winnerId);

    if (winnerId && lottery.pot > 0) {
      const economyManager = new EconomyManager(this.guildId, this.userDb);
      economyManager.AdjustBalance(winnerId, lottery.pot);
    }

    if (channel) {
      try {
        const message = await channel.messages.fetch(lottery.message_id);
        const endedEmbed = this.CreateEndedEmbed({
          entryCost: lottery.entry_cost,
          pot: lottery.pot,
          winnerId,
          hostId: lottery.host_id,
          entryCount: entries.length,
        });
        await message.edit({
          embeds: [endedEmbed.toJSON()],
          components: [],
        });
      } catch {
        // Message may have been deleted
      }
    }

    return { winnerId, entryCount: entries.length };
  }
}
