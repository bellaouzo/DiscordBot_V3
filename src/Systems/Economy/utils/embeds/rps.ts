import { EmbedFactory } from "@utilities";
import { RpsChoice } from "../../types";

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
