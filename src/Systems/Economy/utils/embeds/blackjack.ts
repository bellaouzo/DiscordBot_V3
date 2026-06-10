import { EmbedFactory } from "@utilities";
import type { CardValue } from "../../types";

function FormatHand(
  cards: CardValue[],
  total: number,
  options?: { hideHole?: boolean; holeReplacement?: string },
): string {
  const display = cards
    .map((card, idx) =>
      options?.hideHole && idx === 1 ? (options?.holeReplacement ?? "🂠") : card,
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
      options.playerTotal,
    )}**\nDealer shows: **${FormatHand(
      options.dealerCards,
      options.dealerTotal,
      {
        hideHole: !options.revealDealer,
      },
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
      options.playerTotal,
    )}**\nDealer shows: **${FormatHand(
      options.dealerCards,
      options.dealerTotal,
      {
        hideHole: !options.revealDealer,
      },
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
      ? EmbedFactory.Create.bind(EmbedFactory)
      : EmbedFactory.CreateSuccess.bind(EmbedFactory);

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
