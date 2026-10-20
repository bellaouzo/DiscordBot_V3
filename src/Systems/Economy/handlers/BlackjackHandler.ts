import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { ITEM_MAP } from "@systems/Economy/items";
import {
  BuildBlackjackButtons,
  BuildDisabledBlackjackButtons,
} from "@systems/Economy/utils/BlackjackComponents";
import {
  BuildBlackjackCancelledEmbed,
  BuildBlackjackExpiredEmbed,
  BuildBlackjackProgressEmbed,
  BuildBlackjackPromptEmbed,
  BuildBlackjackResultEmbed,
} from "@systems/Economy/utils/Embeds";
import {
  BJ_BLACKJACK_PAYOUT,
  BJ_DEALER_STAND,
  BJ_TIMEOUT_MS,
} from "@systems/Economy/constants";
import type { CardValue } from "@systems/Economy/types";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import {
  createShuffledDeck,
  drawCard,
  handValue,
  isBlackjack,
} from "@systems/Economy/utils/blackjackLogic";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";
import { InteractiveSession } from "@shared/InteractiveSession";

interface BlackjackCustomIds {
  hit: string;
  stand: string;
  double: string;
  cancel: string;
}

type Outcome = "win" | "loss" | "push" | "blackjack";

export async function HandleBlackjack(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const prepared = await PrepareWager(interaction, context);
  if (!prepared) {
    return;
  }
  const { bet, manager, inventory } = prepared;
  let balance = prepared.balance;

  const charm = ITEM_MAP["dealer-charm"];
  const hasCharm = HasItem(inventory, charm);
  let charmUsed = false;
  const peekItem = ITEM_MAP["bj-peek"];
  const hasPeek = HasItem(inventory, peekItem);
  let peekUsed = false;
  const boostItem = ITEM_MAP["bj-boost"];
  const hasBoost = HasItem(inventory, boostItem);
  let boostUsed = false;

  const session = new InteractiveSession({
    componentRouter,
    ownerId: interaction.user.id,
    timeoutMs: BJ_TIMEOUT_MS,
    onTimeout: () => finalizeTimeout(),
  });
  const customIds: BlackjackCustomIds = {
    hit: "",
    stand: "",
    double: "",
    cancel: "",
  };

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const deck = createShuffledDeck();
  const player: CardValue[] = [drawCard(deck), drawCard(deck)];
  const dealer: CardValue[] = [drawCard(deck), drawCard(deck)];
  let wager = bet;
  let firstAction = true;
  if (peekItem && hasPeek && !peekUsed) {
    peekUsed = true;
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: peekItem.id,
      delta: -1,
    });
  }

  const playerTotal = (): number => handValue(player);
  const dealerTotal = (): number => handValue(dealer);

  const settle = async (
    outcome: Outcome,
    sourceInteraction?: ButtonInteraction,
  ): Promise<void> => {
    if (!session.Resolve()) return;

    let finalOutcome = outcome;
    const notes: string[] = [];

    if (
      finalOutcome === "loss" &&
      charm &&
      hasCharm &&
      !charmUsed &&
      playerTotal() <= 21 &&
      dealerTotal() <= 21 &&
      dealerTotal() - playerTotal() === 1
    ) {
      charmUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: charm.id,
        delta: -1,
      });
      finalOutcome = "push";
      notes.push("Dealer's Charm — close loss converted to push.");
    }

    let payout = 0;
    if (bet > 0) {
      if (finalOutcome === "blackjack") {
        payout = Math.floor(wager * BJ_BLACKJACK_PAYOUT);
      } else if (finalOutcome === "win") {
        payout = wager * 2;
      } else if (finalOutcome === "push") {
        payout = wager;
      }
    }

    if (payout > 0 && boostItem && hasBoost && !boostUsed) {
      boostUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: boostItem.id,
        delta: -1,
      });
      const bonus = Math.floor(wager * 0.2);
      payout += bonus;
      notes.push("High Roller Token — +20% payout.");
    }

    if (payout > 0) {
      balance = manager.AdjustBalance(interaction.user.id, payout);
    }

    const xpOutcome: EconomyOutcome =
      finalOutcome === "win" || finalOutcome === "blackjack"
        ? "win"
        : finalOutcome === "loss"
          ? "loss"
          : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet: wager,
      outcome: xpOutcome,
    });

    const embed = BuildBlackjackResultEmbed({
      outcome: finalOutcome,
      bet: wager,
      payout,
      balance,
      playerCards: player,
      playerTotal: playerTotal(),
      dealerCards: dealer,
      dealerTotal: dealerTotal(),
      note: notes.length ? notes.map((n) => `• ${n}`).join("\n") : undefined,
    });

    const payload = {
      embeds: [embed.toJSON()],
      components: [BuildDisabledBlackjackButtons(customIds)],
    };

    if (sourceInteraction) {
      await buttonResponder.Update(sourceInteraction, payload);
    } else {
      await interaction.editReply(payload);
    }
  };

  const finalizeTimeout = async (): Promise<void> => {
    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, wager);
    }

    const embed = BuildBlackjackExpiredEmbed({
      refunded: wager,
      balance,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledBlackjackButtons(customIds)],
      });
    } finally {
      void 0;
    }
  };

  const handleNatural = async (outcome: Outcome): Promise<void> => {
    session.Resolve();
    let payout = 0;
    if (bet > 0) {
      if (outcome === "blackjack") {
        payout = Math.floor(wager * BJ_BLACKJACK_PAYOUT);
      } else if (outcome === "push") {
        payout = wager;
      }
    }
    if (payout > 0) {
      balance = manager.AdjustBalance(interaction.user.id, payout);
    }

    const xpOutcome: EconomyOutcome =
      outcome === "win" || outcome === "blackjack"
        ? "win"
        : outcome === "loss"
          ? "loss"
          : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet: wager,
      outcome: xpOutcome,
    });

    const embed = BuildBlackjackResultEmbed({
      outcome,
      bet: wager,
      payout,
      balance,
      playerCards: player,
      playerTotal: playerTotal(),
      dealerCards: dealer,
      dealerTotal: dealerTotal(),
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  };

  // Natural blackjack check BEFORE registering buttons
  if (isBlackjack(player) || isBlackjack(dealer)) {
    if (isBlackjack(player) && isBlackjack(dealer)) {
      await handleNatural("push");
    } else if (isBlackjack(player)) {
      await handleNatural("blackjack");
    } else {
      await handleNatural("loss");
    }
    return;
  }

  const canDouble = (): boolean =>
    firstAction && bet > 0 && balance >= wager && player.length === 2;

  const updateBoard = async (
    buttonInteraction: ButtonInteraction | null = null,
  ): Promise<void> => {
    const embed = BuildBlackjackProgressEmbed({
      bet: wager,
      balanceAfterBet: balance,
      playerCards: player,
      playerTotal: playerTotal(),
      dealerCards: dealer,
      dealerTotal: dealerTotal(),
      canDouble: canDouble(),
      revealDealer: peekUsed,
    });

    const payload = {
      embeds: [embed.toJSON()],
      components: [
        BuildBlackjackButtons(customIds, {
          canDouble: canDouble(),
        }),
      ],
    };

    if (buttonInteraction) {
      await buttonResponder.Update(buttonInteraction, payload);
    } else {
      await interaction.editReply(payload);
    }
  };

  const checkPlayerState = async (): Promise<boolean> => {
    const total = playerTotal();
    if (total > 21) {
      await settle("loss");
      return true;
    }
    return false;
  };

  const handleStand = async (
    buttonInteraction?: ButtonInteraction,
  ): Promise<void> => {
    firstAction = false;
    while (dealerTotal() < BJ_DEALER_STAND) {
      dealer.push(drawCard(deck));
    }
    const playerVal = playerTotal();
    const dealerVal = dealerTotal();

    if (dealerVal > 21 || playerVal > dealerVal) {
      await settle("win", buttonInteraction);
    } else if (dealerVal === playerVal) {
      await settle("push", buttonInteraction);
    } else {
      await settle("loss", buttonInteraction);
    }
  };

  const handleHit = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    firstAction = false;
    player.push(drawCard(deck));
    const busted = await checkPlayerState();
    if (busted) return;
    await updateBoard(buttonInteraction);
  };

  const handleDouble = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (!canDouble()) {
      return;
    }
    balance = manager.AdjustBalance(interaction.user.id, -wager, 0);
    wager *= 2;
    firstAction = false;
    player.push(drawCard(deck));
    const busted = await checkPlayerState();
    if (busted) return;
    await handleStand(buttonInteraction);
  };

  const handleCancel = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, wager);
    }

    const embed = BuildBlackjackCancelledEmbed({
      refunded: wager,
      balance,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: [BuildDisabledBlackjackButtons(customIds)],
    });
  };

  customIds.hit = session.RegisterButton((buttonInteraction) =>
    handleHit(buttonInteraction).catch(() => {}),
  );
  customIds.stand = session.RegisterButton((buttonInteraction) =>
    handleStand(buttonInteraction).catch(() => {}),
  );
  customIds.double = session.RegisterButton((buttonInteraction) =>
    handleDouble(buttonInteraction).catch(() => {}),
  );
  customIds.cancel = session.RegisterButton(handleCancel);

  // Natural blackjack check
  if (isBlackjack(player) || isBlackjack(dealer)) {
    if (isBlackjack(player) && isBlackjack(dealer)) {
      await settle("push");
    } else if (isBlackjack(player)) {
      await settle("blackjack");
    } else {
      await settle("loss");
    }
    return;
  }

  const promptEmbed = BuildBlackjackPromptEmbed({
    bet: wager,
    balanceAfterBet: balance,
    playerCards: player,
    playerTotal: playerTotal(),
    dealerCards: dealer,
    dealerTotal: dealerTotal(),
    canDouble: canDouble(),
    revealDealer: peekUsed,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [
      BuildBlackjackButtons(customIds, {
        canDouble: canDouble(),
        disabled: false,
      }),
    ],
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, wager);
    }
    session.Resolve();
    return;
  }

  session.Start();
}
