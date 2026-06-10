import { EmbedFactory } from "@utilities";

export function BuildBalanceEmbed(options: {
  balance: number;
  updatedAt?: number;
  label?: string;
}): ReturnType<typeof EmbedFactory.Create> {
  const label = options.label ?? "You";
  const possessive = label === "You" ? "You have" : `${label} has`;

  return EmbedFactory.Create({
    title: label === "You" ? "💰 Your Coins" : "💰 Coins",
    description: `${possessive} **${options.balance}** coins.`,
    footer: options.updatedAt
      ? `Updated ${new Date(options.updatedAt).toLocaleString()}`
      : undefined,
  });
}
