import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EmbedFactory } from "@utilities";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import type { LotteryManager } from "@systems/Economy/LotteryManager";
import type { TextChannel } from "discord.js";

export function RegisterLotteryEntryHandler(options: {
  lotteryId: number;
  expiresInMs: number;
  manager: LotteryManager;
  channel: TextChannel;
  lotteryMessageId: string;
  context: CommandContext;
}): void {
  const {
    lotteryId,
    expiresInMs,
    manager,
    channel,
    lotteryMessageId,
    context,
  } = options;

  context.responders.componentRouter.RegisterButton({
    customId: `lottery_enter_${lotteryId}`,
    expiresInMs,
    handler: async (buttonInteraction) => {
      const lottery = context.databases.userDb.GetLotteryById(lotteryId);

      if (!lottery || lottery.ended) {
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [
            EmbedFactory.CreateWarning({
              title: "Lottery Ended",
              description: "This lottery has already ended.",
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (lottery.ends_at <= Date.now()) {
        await manager.FinalizeLottery(lottery, channel);
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          content: "This lottery just ended.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (
        context.databases.userDb.HasLotteryEntry(
          lottery.id,
          buttonInteraction.user.id,
        )
      ) {
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          content: "You already entered this lottery.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const economyManager = new EconomyManager(
        lottery.guild_id,
        context.databases.userDb,
      );
      const balance = economyManager.EnsureBalance(buttonInteraction.user.id);

      if (balance < lottery.entry_cost) {
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [
            EmbedFactory.CreateWarning({
              title: "Insufficient Balance",
              description: `You need **${lottery.entry_cost}** coins to enter.`,
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      economyManager.AdjustBalance(
        buttonInteraction.user.id,
        -lottery.entry_cost,
      );
      const added = context.databases.userDb.AddLotteryEntry(
        lottery.id,
        buttonInteraction.user.id,
        lottery.entry_cost,
      );

      if (!added) {
        economyManager.AdjustBalance(
          buttonInteraction.user.id,
          lottery.entry_cost,
        );
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          content: "Could not enter the lottery.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const updated = context.databases.userDb.GetLotteryById(lottery.id);
      const entryCount = context.databases.userDb.GetLotteryEntries(
        lottery.id,
      ).length;

      if (updated) {
        const { embed, row } = manager.CreateLotteryMessage({
          entryCost: updated.entry_cost,
          endsAt: updated.ends_at,
          hostId: updated.host_id,
          pot: updated.pot,
          entryCount,
          lotteryId: updated.id,
        });

        try {
          const message = await channel.messages.fetch(lotteryMessageId);
          await message.edit({
            embeds: [embed.toJSON()],
            components: [row],
          });
        } catch {
          // ignore edit failures
        }
      }

      await context.responders.buttonResponder.Reply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateSuccess({
            title: "Entered Lottery",
            description: `You paid **${lottery.entry_cost}** coins to enter.`,
          }).toJSON(),
        ],
        flags: MessageFlags.Ephemeral,
      });
    },
  });
}
