import { EmbedFactory } from "@utilities";
import { BuildGridDisplay } from "./shared";

export function BuildSlotsResultEmbed(options: {
  grid: string[];
  bet: number;
  payout: number;
  balance: number;
  outcome: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const grid = BuildGridDisplay(options.grid, 3);
  const lines: string[] = [`🎰\n${grid}`, `Outcome: ${options.outcome}`];

  if (options.bet > 0) {
    const net = options.payout - options.bet;
    const netLabel = net >= 0 ? `+${net}` : `${net}`;
    if (options.payout > 0) {
      lines.push(
        `Bet: **${options.bet}**`,
        `Payout: **${netLabel}** (returned ${options.payout})`,
      );
    } else {
      lines.push(`Bet: **${options.bet}**`, "You lost your bet.");
    }
  } else {
    lines.push("Bet: **None** (free spin)");
  }

  lines.push(`Balance: **${options.balance}**`);

  if (options.payout > 0 && options.bet > 0) {
    return EmbedFactory.CreateSuccess({
      title: "🎉 Slots — Win",
      description: lines.join("\n"),
    });
  }

  if (options.bet > 0) {
    return EmbedFactory.CreateWarning({
      title: "🎰 Slots — Loss",
      description: lines.join("\n"),
    });
  }

  return EmbedFactory.Create({
    title: "🎰 Slots",
    description: lines.join("\n"),
  });
}
