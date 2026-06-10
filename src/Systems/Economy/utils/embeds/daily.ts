import { EmbedFactory } from "@utilities";

export function BuildDailyEmbed(options: {
  success: boolean;
  reward: number;
  balance: number;
  nextAvailableAt: number;
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.success) {
    return EmbedFactory.CreateSuccess({
      title: "✅ Daily Claimed",
      description: `You received **${options.reward}** coins.\nNew balance: **${options.balance}**.\nNext daily: <t:${Math.floor(options.nextAvailableAt / 1000)}:R>`,
    });
  }

  return EmbedFactory.CreateWarning({
    title: "⏳ Daily Not Ready",
    description: `You can claim again <t:${Math.floor(options.nextAvailableAt / 1000)}:R>.`,
  });
}
