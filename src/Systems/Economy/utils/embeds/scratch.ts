import { EmbedFactory } from "@utilities";
import type { ScratchSymbol } from "../../types";
import { BuildGridDisplay } from "./shared";

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
    options.columns,
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
