import { EmbedFactory } from "@utilities";

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
        : `Loss: **-${options.bet}**`,
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
