import { RequireGuild } from "@utilities";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EconomyManager } from "../EconomyManager";
import { BuildBalanceEmbed } from "@systems/Economy/utils/Embeds";

export async function HandleBalance(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(
    RequireGuild(interaction).id,
    context.databases.userDb,
  );
  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  const balance = manager.GetBalance(targetUser.id);
  const embed = BuildBalanceEmbed({
    balance,
    label: isSelf ? "You" : `<@${targetUser.id}>`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}
