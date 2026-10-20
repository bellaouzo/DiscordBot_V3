import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { ITEM_MAP } from "@systems/Economy/items";
import {
  BuildDisabledFlipButtons,
  BuildFlipButtons,
} from "@systems/Economy/utils/FlipComponents";
import {
  BuildFlipCancelledEmbed,
  BuildFlipExpiredEmbed,
  BuildFlipPromptEmbed,
  BuildFlipResultEmbed,
} from "@systems/Economy/utils/Embeds";
import { FLIP_TIMEOUT_MS } from "@systems/Economy/constants";
import type { FlipChoice } from "@systems/Economy/types";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { FlipCoin } from "@systems/Economy/utils/flipLogic";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";
import { InteractiveSession } from "@shared/InteractiveSession";

interface FlipCustomIds {
  heads: string;
  tails: string;
  cancel: string;
}

export async function HandleFlip(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const prepared = await PrepareWager(
    interaction,
    context,
    (title, description, balance) =>
      BuildFlipPromptEmbed({ bet: 0, balanceAfterBet: balance })
        .setTitle(title)
        .setDescription(description),
  );
  if (!prepared) {
    return;
  }
  const { bet, manager, inventory } = prepared;
  let balanceValue = prepared.balance;

  const luckyCoin = ITEM_MAP["lucky-coin"];
  const flipCharm = ITEM_MAP["flip-charm"];
  const coinGuardian = ITEM_MAP["coin-guardian"];
  const hasLuckyCoin = HasItem(inventory, luckyCoin);
  const hasFlipCharm = HasItem(inventory, flipCharm);
  const hasCoinGuardian = HasItem(inventory, coinGuardian);

  const customIds: FlipCustomIds = {
    heads: "",
    tails: "",
    cancel: "",
  };

  const finalizeTimeout = async (): Promise<void> => {
    if (bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildFlipExpiredEmbed({
      refunded: bet,
      balance: balanceValue,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledFlipButtons(customIds)],
      });
    } finally {
      void 0;
    }
  };

  const handleResult = async (
    buttonInteraction: ButtonInteraction,
    playerChoice: FlipChoice,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This flip has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let flipResult: FlipChoice = FlipCoin();
    let win = flipResult === playerChoice;
    const notes: string[] = [];

    if (!win && luckyCoin && hasLuckyCoin) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: luckyCoin.id,
        delta: -1,
      });
      flipResult = FlipCoin();
      win = flipResult === playerChoice;
      notes.push("Lucky Coin — rerolled the flip once.");
    }

    let payout = 0;
    if (bet > 0 && win) {
      payout = bet * 2;
    } else if (bet > 0 && !win && coinGuardian && hasCoinGuardian) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: coinGuardian.id,
        delta: -1,
      });
      payout = bet; // refund
      notes.push("Coin Guardian — loss refunded.");
    }

    if (win && bet > 0 && flipCharm && hasFlipCharm) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: flipCharm.id,
        delta: -1,
      });
      const bonus = Math.floor(bet * 0.5);
      payout += bonus;
      notes.push("Flip Charm — +50% win payout.");
    }

    if (payout > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, payout);
    } else if (!win && bet > 0 && !hasCoinGuardian) {
      // bet already locked, remains lost
    }

    const resultEmbed = BuildFlipResultEmbed({
      result: flipResult,
      playerChoice,
      win,
      bet,
      balance: balanceValue,
      note: notes.length ? notes.map((n) => `• ${n}`).join("\n") : undefined,
    });

    const outcome: EconomyOutcome = win ? "win" : bet > 0 ? "loss" : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet,
      outcome,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [resultEmbed.toJSON()],
      components: [BuildDisabledFlipButtons(customIds)],
    });
  };

  const handleCancel = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This flip has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildFlipCancelledEmbed({
      refunded: bet,
      balance: balanceValue,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: [BuildDisabledFlipButtons(customIds)],
    });
  };

  // Lock bet upfront if any
  if (bet > 0) {
    balanceValue = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const session = new InteractiveSession({
    componentRouter,
    ownerId: interaction.user.id,
    timeoutMs: FLIP_TIMEOUT_MS,
    onTimeout: finalizeTimeout,
  });
  customIds.heads = session.RegisterButton((buttonInteraction) =>
    handleResult(buttonInteraction, "heads"),
  );
  customIds.tails = session.RegisterButton((buttonInteraction) =>
    handleResult(buttonInteraction, "tails"),
  );
  customIds.cancel = session.RegisterButton(handleCancel);

  const promptEmbed = BuildFlipPromptEmbed({
    bet,
    balanceAfterBet: balanceValue,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildFlipButtons(customIds)],
  });

  if (!replyResult.success) {
    // Refund and dispose on failure to send
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet);
    }
    session.Resolve();
    return;
  }

  session.Start();
}
