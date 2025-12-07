import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@commands/fun/economy/EconomyManager";
import { BuildDailyEmbed } from "@commands/fun/economy/utils/Embeds";
import { DAILY_REWARD } from "@commands/fun/economy/constants";

export async function HandleDaily(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(interaction.guildId!, context.logger);

  try {
    const result = manager.ClaimDaily(interaction.user.id);

    const embed = BuildDailyEmbed({
      success: result.success,
      reward: DAILY_REWARD,
      balance: result.success ? result.balance : 0,
      nextAvailableAt: result.nextAvailableAt,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    manager.Close();
  }
}
