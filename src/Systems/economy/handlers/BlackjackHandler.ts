import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/economy/EconomyManager";
import { ITEM_MAP } from "@systems/economy/items";
import {
  BuildBlackjackButtons,
  BuildDisabledBlackjackButtons,
} from "@systems/economy/utils/BlackjackComponents";
import {
  BuildBlackjackCancelledEmbed,
  BuildBlackjackExpiredEmbed,
  BuildBlackjackProgressEmbed,
  BuildBlackjackPromptEmbed,
  BuildBlackjackResultEmbed,
} from "@systems/economy/utils/Embeds";
import {
  BJ_BLACKJACK_PAYOUT,
  BJ_DEALER_STAND,
  BJ_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
} from "@systems/economy/constants";
import { CardValue } from "@systems/economy/types";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/economy/utils/EconomyXp";

interface BlackjackCustomIds {
  hit: string;
  stand: string;
  double: string;
  cancel: string;
}

type Outcome = "win" | "loss" | "push" | "blackjack";

const DECK: CardValue[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function createShuffledDeck(): CardValue[] {
  const cards: CardValue[] = [];
  for (let i = 0; i < 4; i++) {
    cards.push(...DECK);
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function drawCard(deck: CardValue[]): CardValue {
  return deck.pop()!;
}

function handValue(cards: CardValue[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card)) {
      total += 10;
    } else {
      total += parseInt(card, 10);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isBlackjack(cards: CardValue[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export async function HandleBlackjack(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const bet = interaction.options.getInteger("bet") ?? 0;

  if (bet !== 0 && (bet < MIN_BET || bet > MAX_BET)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Invalid Bet",
      description: `Bet must be between ${MIN_BET} and ${MAX_BET}.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const manager = new EconomyManager(interaction.guildId!, context.databases.userDb);
  let balance = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const charm = ITEM_MAP["dealer-charm"];
  const hasCharm =
    charm &&
    inventory.some((entry) => entry.itemId === charm.id && entry.quantity > 0);
  let charmUsed = false;
  const peekItem = ITEM_MAP["bj-peek"];
  const hasPeek =
    peekItem &&
    inventory.some(
      (entry) => entry.itemId === peekItem.id && entry.quantity > 0
    );
  let peekUsed = false;
  const boostItem = ITEM_MAP["bj-boost"];
  const hasBoost =
    boostItem &&
    inventory.some(
      (entry) => entry.itemId === boostItem.id && entry.quantity > 0
    );
  let boostUsed = false;

  if (bet > balance) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Enough Coins",
      description: `You only have **${balance}** coins.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;
  const customIds: BlackjackCustomIds = {
    hit: "",
    stand: "",
    double: "",
    cancel: "",
  };

  const registrations: Array<{ dispose: () => void }> = [];

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const deck = createShuffledDeck();
  const player: CardValue[] = [drawCard(deck), drawCard(deck)];
  const dealer: CardValue[] = [drawCard(deck), drawCard(deck)];
  let wager = bet;
  let firstAction = true;
  if (hasPeek && !peekUsed) {
    peekUsed = true;
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: peekItem!.id,
      delta: -1,
    });
  }

  const playerTotal = (): number => handValue(player);
  const dealerTotal = (): number => handValue(dealer);

  const settle = async (
    outcome: Outcome,
    sourceInteraction?: ButtonInteraction
  ): Promise<void> => {
    if (resolved) return;
    resolved = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);

    let finalOutcome = outcome;
    const notes: string[] = [];

    if (
      finalOutcome === "loss" &&
      hasCharm &&
      !charmUsed &&
      playerTotal() <= 21 &&
      dealerTotal() <= 21 &&
      dealerTotal() - playerTotal() === 1
    ) {
      charmUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: charm!.id,
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

    if (payout > 0 && hasBoost && !boostUsed) {
      boostUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: boostItem!.id,
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
    if (resolved) return;
    resolved = true;

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
    }
  };

  const handleNatural = async (outcome: Outcome): Promise<void> => {
    resolved = true;
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
      ephemeral: true,
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
    buttonInteraction: ButtonInteraction | null = null
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
    buttonInteraction?: ButtonInteraction
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
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    firstAction = false;
    player.push(drawCard(deck));
    const busted = await checkPlayerState();
    if (busted) return;
    await updateBoard(buttonInteraction);
  };

  const handleDouble = async (
    buttonInteraction: ButtonInteraction
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
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);

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

  const hitRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: BJ_TIMEOUT_MS,
    handler: (buttonInteraction) =>
      handleHit(buttonInteraction).catch(() => {}),
  });
  const standRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: BJ_TIMEOUT_MS,
    handler: (buttonInteraction) =>
      handleStand(buttonInteraction).catch(() => {}),
  });
  const doubleRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: BJ_TIMEOUT_MS,
    handler: (buttonInteraction) =>
      handleDouble(buttonInteraction).catch(() => {}),
  });
  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: BJ_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(
    hitRegistration,
    standRegistration,
    doubleRegistration,
    cancelRegistration
  );

  customIds.hit = hitRegistration.customId;
  customIds.stand = standRegistration.customId;
  customIds.double = doubleRegistration.customId;
  customIds.cancel = cancelRegistration.customId;

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
    ephemeral: false,
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, wager);
    }
    return;
  }

  timeoutHandle = setTimeout(() => {
    void finalizeTimeout();
  }, BJ_TIMEOUT_MS);
}


