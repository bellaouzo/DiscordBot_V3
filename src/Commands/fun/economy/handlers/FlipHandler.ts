import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@commands/fun/economy/EconomyManager";
import { ITEM_MAP } from "@commands/fun/economy/items";
import {
  BuildDisabledFlipButtons,
  BuildFlipButtons,
} from "@commands/fun/economy/utils/FlipComponents";
import {
  BuildFlipCancelledEmbed,
  BuildFlipExpiredEmbed,
  BuildFlipPromptEmbed,
  BuildFlipResultEmbed,
} from "@commands/fun/economy/utils/Embeds";
import {
  FLIP_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
} from "@commands/fun/economy/constants";
import { FlipChoice } from "@commands/fun/economy/types";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@commands/fun/economy/utils/EconomyXp";

interface FlipCustomIds {
  heads: string;
  tails: string;
  cancel: string;
}

export async function HandleFlip(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const bet = interaction.options.getInteger("bet") ?? 0;

  if (bet !== 0 && (bet < MIN_BET || bet > MAX_BET)) {
    const embed = BuildFlipPromptEmbed({ bet: 0, balanceAfterBet: 0 });
    await interactionResponder.Reply(interaction, {
      embeds: [
        embed
          .setTitle("Invalid Bet")
          .setDescription(`Bet must be between ${MIN_BET} and ${MAX_BET}.`)
          .toJSON(),
      ],
      ephemeral: true,
    });
    return;
  }

  const manager = new EconomyManager(interaction.guildId!, context.databases.userDb);
  let balanceValue = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const luckyCoin = ITEM_MAP["lucky-coin"];
  const flipCharm = ITEM_MAP["flip-charm"];
  const coinGuardian = ITEM_MAP["coin-guardian"];
  const hasLuckyCoin =
    luckyCoin &&
    inventory.some(
      (entry) => entry.itemId === luckyCoin.id && entry.quantity > 0
    );
  const hasFlipCharm =
    flipCharm &&
    inventory.some(
      (entry) => entry.itemId === flipCharm.id && entry.quantity > 0
    );
  const hasCoinGuardian =
    coinGuardian &&
    inventory.some(
      (entry) => entry.itemId === coinGuardian.id && entry.quantity > 0
    );

  if (bet > balanceValue) {
    const embed = BuildFlipPromptEmbed({
      bet: 0,
      balanceAfterBet: balanceValue,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [
        embed
          .setTitle("Not Enough Coins")
          .setDescription(`You only have **${balanceValue}** coins.`)
          .toJSON(),
      ],
      ephemeral: true,
    });
    return;
  }

  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const customIds: FlipCustomIds = {
    heads: "",
    tails: "",
    cancel: "",
  };

  const registrations: Array<{ dispose: () => void }> = [];
  const disposeAll = (): void => {
    registrations.forEach((reg) => reg.dispose());
  };

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();

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
    }
  };

  const handleResult = async (
    buttonInteraction: ButtonInteraction,
    playerChoice: FlipChoice
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This flip has already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    const roll = (): FlipChoice => (Math.random() < 0.5 ? "heads" : "tails");
    let flipResult: FlipChoice = roll();
    let win = flipResult === playerChoice;
    const notes: string[] = [];

    if (!win && hasLuckyCoin) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: luckyCoin!.id,
        delta: -1,
      });
      flipResult = roll();
      win = flipResult === playerChoice;
      notes.push("Lucky Coin — rerolled the flip once.");
    }

    let payout = 0;
    if (bet > 0 && win) {
      payout = bet * 2;
    } else if (bet > 0 && !win && hasCoinGuardian) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: coinGuardian!.id,
        delta: -1,
      });
      payout = bet; // refund
      notes.push("Coin Guardian — loss refunded.");
    }

    if (win && bet > 0 && hasFlipCharm) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: flipCharm!.id,
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

    const outcome: EconomyOutcome =
      win ? "win" : bet > 0 ? "loss" : "neutral";
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
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This flip has already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

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

  const headsRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: FLIP_TIMEOUT_MS,
    handler: (buttonInteraction) => handleResult(buttonInteraction, "heads"),
  });
  const tailsRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: FLIP_TIMEOUT_MS,
    handler: (buttonInteraction) => handleResult(buttonInteraction, "tails"),
  });
  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: FLIP_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(headsRegistration, tailsRegistration, cancelRegistration);
  customIds.heads = headsRegistration.customId;
  customIds.tails = tailsRegistration.customId;
  customIds.cancel = cancelRegistration.customId;

  const promptEmbed = BuildFlipPromptEmbed({
    bet,
    balanceAfterBet: balanceValue,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildFlipButtons(customIds)],
    ephemeral: false,
  });

  if (!replyResult.success) {
    // Refund and dispose on failure to send
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet);
    }
    disposeAll();
    return;
  }

  timeoutHandle = setTimeout(() => {
    void finalizeTimeout();
  }, FLIP_TIMEOUT_MS);
}


