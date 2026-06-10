import { EmbedFactory } from "@utilities";

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
        `Payout: **+${options.payout - options.bet}** (total ${options.payout})`,
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
