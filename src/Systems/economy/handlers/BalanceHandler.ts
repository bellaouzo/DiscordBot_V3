import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "../EconomyManager";
import { BuildBalanceEmbed } from "@systems/economy/utils/Embeds";

export async function HandleBalance(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(interaction.guildId!, context.databases.userDb);
  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  const balance = manager.GetBalance(targetUser.id);
  const embed = BuildBalanceEmbed({
    balance,
    label: isSelf ? "You" : `<@${targetUser.id}>`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}


