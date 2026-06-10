import { EmbedFactory } from "@utilities";

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
          2,
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
      2,
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
