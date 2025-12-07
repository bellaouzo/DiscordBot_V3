import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "../EconomyManager";
import { BuildBalanceEmbed } from "@commands/fun/economy/utils/Embeds";

export async function HandleBalance(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(interaction.guildId!, context.logger);

  try {
    const balance = manager.GetBalance(interaction.user.id);
    const embed = BuildBalanceEmbed({ balance });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    manager.Close();
  }
}
