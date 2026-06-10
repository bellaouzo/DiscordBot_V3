import { EmbedFactory } from "@utilities";

export function BuildLeaderboardEmbed(options: {
  entries: Array<{
    rank: number;
    userId: string;
    balance: number;
    name?: string;
  }>;
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.entries.length === 0) {
    return EmbedFactory.Create({
      title: "🏆 Coin Leaderboard",
      description: "No balances recorded yet.",
    });
  }

  const lines = options.entries.map((entry) => {
    const label = entry.name ? entry.name : `<@${entry.userId}>`;
    return `#${entry.rank} — ${label}: **${entry.balance}** coins`;
  });

  return EmbedFactory.Create({
    title: "🏆 Coin Leaderboard",
    description: lines.join("\n"),
  });
}
