import { EmbedFactory } from "@utilities";
import {
  FlipChoice,
  RpsChoice,
  ScratchSymbol,
  CardValue,
  InventoryEntry,
  MarketOffer,
} from "../types";
import { ITEM_MAP } from "../items";

function BuildGridDisplay(values: string[], columns: number): string {
  const rows: string[] = [];
  for (let i = 0; i < values.length; i += columns) {
    rows.push(values.slice(i, i + columns).join("  "));
  }
  return rows.join("\n");
}

export function BuildBalanceEmbed(options: {
  balance: number;
  updatedAt?: number;
}): ReturnType<typeof EmbedFactory.Create> {
  return EmbedFactory.Create({
    title: "💰 Your Coins",
    description: `You have **${options.balance}** coins.`,
    footer: options.updatedAt
      ? `Updated ${new Date(options.updatedAt).toLocaleString()}`
      : undefined,
  });
}

export function BuildFlipPromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed. Pick heads or tails for fun!";

  return EmbedFactory.Create({
    title: "🪙 Coin Flip",
    description: `${betLine}\n\nChoose **Heads** or **Tails** below.`,
  });
}

export function BuildFlipResultEmbed(options: {
  result: FlipChoice;
  playerChoice: FlipChoice;
  win: boolean;
  bet: number;
  balance: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const lines: string[] = [
    `Result: **${options.result.toUpperCase()}**`,
    `You chose: **${options.playerChoice.toUpperCase()}**`,
  ];

  if (options.bet > 0) {
    lines.push(`Bet: **${options.bet}**`);
    lines.push(
      options.win
        ? `Payout: **+${options.bet}** (2x return)`
        : `Loss: **-${options.bet}**`
    );
  } else {
    lines.push("Bet: **None**");
  }

  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  return options.win
    ? EmbedFactory.CreateSuccess({
        title: "🎉 Coin Flip — Win",
        description: lines.join("\n"),
      })
    : EmbedFactory.CreateWarning({
        title: "😔 Coin Flip — Loss",
        description: lines.join("\n"),
      });
}

export function BuildFlipCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ Coin Flip Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildFlipExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ Coin Flip Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildRpsPromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed. Choose a hand to play!";

  return EmbedFactory.Create({
    title: "✊✋✌️ Rock Paper Scissors",
    description: `${betLine}\n\nPick **Rock**, **Paper**, or **Scissors** below.`,
  });
}

export function BuildRpsResultEmbed(options: {
  botChoice: RpsChoice;
  playerChoice: RpsChoice;
  outcome: "win" | "loss" | "draw";
  bet: number;
  balance: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const lines: string[] = [
    `Bot chose: **${options.botChoice.toUpperCase()}**`,
    `You chose: **${options.playerChoice.toUpperCase()}**`,
  ];

  if (options.bet > 0) {
    lines.push(`Bet: **${options.bet}**`);
    if (options.outcome === "win") {
      lines.push(`Payout: **+${options.bet}** (2x return)`);
    } else if (options.outcome === "draw") {
      lines.push("Payout: **0** (bet refunded)");
    } else {
      lines.push(`Loss: **-${options.bet}**`);
    }
  } else {
    lines.push("Bet: **None**");
  }

  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  if (options.outcome === "win") {
    return EmbedFactory.CreateSuccess({
      title: "🎉 RPS — Win",
      description: lines.join("\n"),
    });
  }

  if (options.outcome === "draw") {
    return EmbedFactory.Create({
      title: "🤝 RPS — Draw",
      description: lines.join("\n"),
    });
  }

  return EmbedFactory.CreateWarning({
    title: "😔 RPS — Loss",
    description: lines.join("\n"),
  });
}

export function BuildRpsCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ RPS Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildRpsExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ RPS Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildCrashPromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed. Cashing out will not affect coins.";

  const lines = [`${betLine}`, "", "Press **Cash Out** before it crashes!"];
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  return EmbedFactory.Create({
    title: "🚀 Crash",
    description: lines.join("\n"),
  });
}

export function BuildCrashProgressEmbed(options: {
  bet: number;
  multiplier: number;
  balanceAfterBet: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** (locked)\nPotential: **${Math.floor(options.bet * options.multiplier)}** at ${options.multiplier.toFixed(
          2
        )}x`
      : `No bet placed\nCurrent multiplier: **${options.multiplier.toFixed(2)}x**`;

  return EmbedFactory.Create({
    title: "🚀 Crash — Live",
    description: `${betLine}\nBalance after bet: **${options.balanceAfterBet}**\n\nCash out anytime.`,
  });
}

export function BuildCrashCashoutEmbed(options: {
  bet: number;
  multiplier: number;
  payout: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateSuccess> {
  return EmbedFactory.CreateSuccess({
    title: "✅ Cashed Out",
    description: `Cashed out at **${options.multiplier.toFixed(
      2
    )}x**\nBet: **${options.bet}**\nPayout: **+${options.payout - options.bet}** (total ${options.payout})\nBalance: **${options.balance}**`,
  });
}

export function BuildCrashCrashedEmbed(options: {
  crashedAt: number;
  bet: number;
  balance: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const betLine =
    options.bet > 0
      ? `You lost **${options.bet}** coins.`
      : "No bet was placed.";

  const lines = [
    `Crashed at **${options.crashedAt.toFixed(2)}x**`,
    betLine,
    `Balance: **${options.balance}**`,
  ];
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  return EmbedFactory.CreateWarning({
    title: "💥 Crashed",
    description: lines.join("\n"),
  });
}

export function BuildCrashCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ Crash Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildCrashExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ Crash Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildHorsePromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
  horses: string[];
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed. Pick a horse for fun!";

  const horseLines = options.horses
    .map((horse, index) => `${index + 1}. ${horse}`)
    .join("\n");

  return EmbedFactory.Create({
    title: "🏇 Horse Race",
    description: `${betLine}\n\nChoose a horse below:\n${horseLines}`,
  });
}

export function BuildHorseProgressEmbed(options: {
  bet: number;
  horses: string[];
  positions: number[];
  trackLength: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const track = options.positions
    .map((pos, index) => {
      const progress = Math.min(pos, options.trackLength);
      const lane =
        "•".repeat(progress) +
        "🏇" +
        "—".repeat(Math.max(options.trackLength - progress, 0)) +
        "🏁";
      return `${options.horses[index]}  ${lane}`;
    })
    .join("\n");

  const betLine =
    options.bet > 0
      ? `Bet locked: **${options.bet}**`
      : "Bet: **None** (just for fun)";

  const parts = [`${betLine}\n`, track];
  if (options.note) {
    parts.push(`\n**Item Used:** ${options.note}`);
  }

  return EmbedFactory.Create({
    title: "🏇 Horse Race — Live",
    description: parts.join("\n"),
  });
}

export function BuildHorseResultEmbed(options: {
  bet: number;
  playerHorse: number;
  winningHorse: number;
  payout: number;
  balance: number;
  horses: string[];
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const playerLabel = options.horses[options.playerHorse] ?? "Your horse";
  const winnerLabel = options.horses[options.winningHorse] ?? "Winner";
  const won = options.playerHorse === options.winningHorse;

  const lines: string[] = [
    `Your pick: **${playerLabel}**`,
    `Winner: **${winnerLabel}**`,
  ];

  if (options.bet > 0) {
    if (won) {
      lines.push(
        `Payout: **+${options.payout - options.bet}** (total ${options.payout})`
      );
    } else {
      lines.push(`Loss: **-${options.bet}**`);
    }
  } else {
    lines.push("Bet: **None**");
  }

  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  if (won) {
    return EmbedFactory.CreateSuccess({
      title: "🏆 Horse Race — Win",
      description: lines.join("\n"),
    });
  }

  return EmbedFactory.CreateWarning({
    title: "💥 Horse Race — Loss",
    description: lines.join("\n"),
  });
}

export function BuildHorseCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ Horse Race Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildHorseExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ Horse Race Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildScratchPromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
  hiddenIcons: string[];
  columns: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed. Scratch for fun!";

  const hidden = BuildGridDisplay(options.hiddenIcons, options.columns);

  const parts = [`${betLine}\n`, `Scratch the card:\n${hidden}`];
  if (options.note) {
    parts.push(`\n**Item Used:** ${options.note}`);
  }

  return EmbedFactory.Create({
    title: "🎟️ Scratch Card",
    description: parts.join("\n"),
  });
}

export function BuildScratchProgressEmbed(options: {
  bet: number;
  reveals: Array<ScratchSymbol | null>;
  hiddenIcons: string[];
  columns: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const display = BuildGridDisplay(
    options.reveals.map((symbol, idx) => symbol ?? options.hiddenIcons[idx]),
    options.columns
  );

  const betLine =
    options.bet > 0
      ? `Bet locked: **${options.bet}**`
      : "Bet: **None** (just for fun)";

  const parts = [`${betLine}\n`, display];
  if (options.note) {
    parts.push(`\n**Item Used:** ${options.note}`);
  }

  return EmbedFactory.Create({
    title: "🎟️ Scratch Card — In Progress",
    description: parts.join("\n"),
  });
}

export function BuildScratchResultEmbed(options: {
  bet: number;
  payout: number;
  balance: number;
  reveals: ScratchSymbol[];
  columns: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const display = BuildGridDisplay(options.reveals, options.columns);
  const win = options.payout > 0;

  const lines: string[] = [display];
  if (options.bet > 0) {
    if (win) {
      lines.push(
        `Payout: **+${options.payout - options.bet}** (total ${options.payout})`
      );
    } else {
      lines.push(`Loss: **-${options.bet}**`);
    }
  } else {
    lines.push("Bet: **None**");
  }
  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(options.note);
  }

  if (win) {
    return EmbedFactory.CreateSuccess({
      title: "🎉 Scratch Win",
      description: lines.join("\n"),
    });
  }

  return EmbedFactory.CreateWarning({
    title: "🙃 Scratch Loss",
    description: lines.join("\n"),
  });
}

export function BuildScratchCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ Scratch Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildScratchExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ Scratch Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

function FormatHand(
  cards: CardValue[],
  total: number,
  options?: { hideHole?: boolean; holeReplacement?: string }
): string {
  const display = cards
    .map((card, idx) =>
      options?.hideHole && idx === 1 ? (options?.holeReplacement ?? "🂠") : card
    )
    .join(" ");
  return `${display} (total: ${options?.hideHole ? "?" : total})`;
}

export function BuildBlackjackPromptEmbed(options: {
  bet: number;
  balanceAfterBet: number;
  playerCards: CardValue[];
  playerTotal: number;
  dealerCards: CardValue[];
  dealerTotal: number;
  canDouble: boolean;
  revealDealer?: boolean;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet: **${options.bet}** coins (locked in)\nBalance after bet: **${options.balanceAfterBet}**`
      : "No bet placed (for fun only).";

  return EmbedFactory.Create({
    title: "🂡 Blackjack",
    description: `${betLine}\n\nYour hand: **${FormatHand(
      options.playerCards,
      options.playerTotal
    )}**\nDealer shows: **${FormatHand(
      options.dealerCards,
      options.dealerTotal,
      {
        hideHole: !options.revealDealer,
      }
    )}**\n\nChoose an action below.${options.canDouble ? "" : " (Double unavailable)"}`,
  });
}

export function BuildBlackjackProgressEmbed(options: {
  bet: number;
  balanceAfterBet: number;
  playerCards: CardValue[];
  playerTotal: number;
  dealerCards: CardValue[];
  dealerTotal: number;
  canDouble: boolean;
  revealDealer?: boolean;
}): ReturnType<typeof EmbedFactory.Create> {
  const betLine =
    options.bet > 0
      ? `Bet locked: **${options.bet}**`
      : "Bet: **None** (for fun only)";

  return EmbedFactory.Create({
    title: "🂡 Blackjack — In Progress",
    description: `${betLine}\n\nYour hand: **${FormatHand(
      options.playerCards,
      options.playerTotal
    )}**\nDealer shows: **${FormatHand(
      options.dealerCards,
      options.dealerTotal,
      {
        hideHole: !options.revealDealer,
      }
    )}**\n\nChoose an action below.${options.canDouble ? "" : " (Double unavailable)"}`,
  });
}

export function BuildBlackjackResultEmbed(options: {
  outcome: "win" | "loss" | "push" | "blackjack";
  bet: number;
  payout: number;
  balance: number;
  playerCards: CardValue[];
  playerTotal: number;
  dealerCards: CardValue[];
  dealerTotal: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const lines: string[] = [
    `Your hand: **${FormatHand(options.playerCards, options.playerTotal)}**`,
    `Dealer hand: **${FormatHand(options.dealerCards, options.dealerTotal)}**`,
  ];

  if (options.bet > 0) {
    if (options.outcome === "push") {
      lines.push("Result: Push (bet returned)");
    } else if (options.outcome === "blackjack") {
      lines.push(`Payout: **+${options.payout - options.bet}** (blackjack)`);
    } else if (options.outcome === "win") {
      lines.push(`Payout: **+${options.payout - options.bet}**`);
    } else {
      lines.push(`Loss: **-${options.bet}**`);
    }
  } else {
    lines.push("Bet: **None**");
  }

  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  if (options.outcome === "loss") {
    return EmbedFactory.CreateWarning({
      title: "🙃 Blackjack — Loss",
      description: lines.join("\n"),
    });
  }

  const title =
    options.outcome === "blackjack"
      ? "🎉 Blackjack — Natural!"
      : options.outcome === "push"
        ? "🤝 Blackjack — Push"
        : "🎉 Blackjack — Win";

  const factory =
    options.outcome === "push"
      ? EmbedFactory.Create
      : EmbedFactory.CreateSuccess;

  return factory({
    title,
    description: lines.join("\n"),
  });
}

export function BuildBlackjackCancelledEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.Create({
    title: "⏹ Blackjack Cancelled",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildBlackjackExpiredEmbed(options: {
  refunded: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  const refundedLine =
    options.refunded > 0
      ? `Bet refunded: **${options.refunded}**`
      : "No bet was placed.";

  return EmbedFactory.CreateWarning({
    title: "⌛ Blackjack Timed Out",
    description: `${refundedLine}\nBalance: **${options.balance}**`,
  });
}

export function BuildDailyEmbed(options: {
  success: boolean;
  reward: number;
  balance: number;
  nextAvailableAt: number;
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.success) {
    return EmbedFactory.CreateSuccess({
      title: "✅ Daily Claimed",
      description: `You received **${options.reward}** coins.\nNew balance: **${options.balance}**.\nNext daily: <t:${Math.floor(options.nextAvailableAt / 1000)}:R>`,
    });
  }

  return EmbedFactory.CreateWarning({
    title: "⏳ Daily Not Ready",
    description: `You can claim again <t:${Math.floor(options.nextAvailableAt / 1000)}:R>.`,
  });
}

export function BuildDiceResultEmbed(options: {
  rolled: number;
  guess?: number | null;
  bet: number;
  win: boolean;
  payout: number;
  balance: number;
  note?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const lines: string[] = [`Rolled: **${options.rolled}**`];

  if (options.guess !== undefined && options.guess !== null) {
    lines.push(`Your guess: **${options.guess}**`);
  }

  if (options.bet > 0) {
    lines.push(`Bet: **${options.bet}**`);
    lines.push(
      options.win
        ? `Payout: **+${options.payout - options.bet}** (total return ${options.payout})`
        : `Loss: **-${options.bet}**`
    );
  } else {
    lines.push("Bet: **None**");
  }

  lines.push(`Balance: **${options.balance}**`);
  if (options.note) {
    lines.push(`**Item Used:** ${options.note}`);
  }

  return options.win
    ? EmbedFactory.CreateSuccess({
        title: "🎲 Dice — Win",
        description: lines.join("\n"),
      })
    : EmbedFactory.CreateWarning({
        title: "🎲 Dice — Loss",
        description: lines.join("\n"),
      });
}

export function BuildMarketEmbed(options: {
  offers: MarketOffer[];
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.offers.length === 0) {
    return EmbedFactory.Create({
      title: "🛒 Market",
      description: "No items are available in this rotation.",
    });
  }

  const lines = options.offers.map((offer) => {
    const rarity = offer.item.rarity.toUpperCase();
    const effect = offer.item.effect ? ` • Effect: ${offer.item.effect}` : "";
    return `${offer.item.name} — **${offer.item.price}** coins (sell ${offer.item.sellPrice}) [${rarity}]${effect}`;
  });

  lines.push(
    `Rotation ends <t:${Math.floor(
      options.offers[0].rotationExpiresAt / 1000
    )}:R>.`
  );

  return EmbedFactory.Create({
    title: "🛒 Market",
    description: lines.join("\n"),
  });
}

export function BuildInventoryEmbed(options: {
  entries: InventoryEntry[];
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.entries.length === 0) {
    return EmbedFactory.Create({
      title: "🎒 Inventory",
      description: "Your inventory is empty.",
    });
  }

  const lines = options.entries.map((entry) => {
    const item = ITEM_MAP[entry.itemId];
    const name = item ? item.name : entry.itemId;
    const rarity = item ? ` [${item.rarity.toUpperCase()}]` : "";
    return `${name}${rarity}: **${entry.quantity}**`;
  });

  return EmbedFactory.Create({
    title: "🎒 Inventory",
    description: lines.join("\n"),
  });
}

export function BuildMarketActionSuccessEmbed(options: {
  action: "buy" | "sell";
  itemName: string;
  quantity: number;
  balance: number;
  newQuantity: number;
}): ReturnType<typeof EmbedFactory.CreateSuccess> {
  const verb = options.action === "buy" ? "purchased" : "sold";
  return EmbedFactory.CreateSuccess({
    title: `✅ Market ${options.action === "buy" ? "Buy" : "Sell"}`,
    description: `You ${verb} **${options.quantity}x ${options.itemName}**.\nInventory: **${options.newQuantity}**\nBalance: **${options.balance}**`,
  });
}

export function BuildMarketErrorEmbed(options: {
  message: string;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  return EmbedFactory.CreateWarning({
    title: "Market Error",
    description: options.message,
  });
}
