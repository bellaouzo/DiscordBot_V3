import { EmbedFactory } from "@utilities";
import { FlipChoice } from "../../types";

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
