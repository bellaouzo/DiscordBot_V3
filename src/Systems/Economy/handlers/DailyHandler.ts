import { RequireGuild } from "@utilities";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { BuildDailyEmbed } from "@systems/Economy/utils/Embeds";
import { DAILY_REWARD } from "@systems/Economy/constants";

export async function HandleDaily(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(
    RequireGuild(interaction).id,
    context.databases.userDb,
  );

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
      flags: MessageFlags.Ephemeral,
    });
  } finally {
    void 0;
  }
}
