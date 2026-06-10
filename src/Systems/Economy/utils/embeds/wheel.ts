import { EmbedFactory } from "@utilities";

export function BuildWheelResultEmbed(options: {
  segmentLabel: string;
  multiplier: number;
  bet: number;
  payout: number;
  balance: number;
}): ReturnType<typeof EmbedFactory.Create> {
  const lines: string[] = [
    `Landed on: **${options.segmentLabel}**`,
    `Multiplier: **${options.multiplier.toFixed(2)}x**`,
  ];

  if (options.bet > 0) {
    const net = options.payout - options.bet;
    const netLabel = net >= 0 ? `+${net}` : `${net}`;
    lines.push(
      `Bet: **${options.bet}**`,
      `Payout: **${netLabel}** (returned ${options.payout})`,
    );
  } else {
    lines.push("Bet: **None** (free spin)");
  }

  lines.push(`Balance: **${options.balance}**`);

  if (options.payout > options.bet && options.bet > 0) {
    return EmbedFactory.CreateSuccess({
      title: "🎡 Wheel — Win",
      description: lines.join("\n"),
    });
  }

  if (options.bet > 0 && options.payout === options.bet) {
    return EmbedFactory.Create({
      title: "🎡 Wheel — Break Even",
      description: lines.join("\n"),
    });
  }

  if (options.bet > 0) {
    return EmbedFactory.CreateWarning({
      title: "🎡 Wheel — Loss",
      description: lines.join("\n"),
    });
  }

  return EmbedFactory.Create({
    title: "🎡 Wheel",
    description: lines.join("\n"),
  });
}
