import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/economy/EconomyManager";
import { BuildGiftSuccessEmbed } from "@systems/economy/utils/Embeds";
import { EmbedFactory } from "@utilities";

export async function HandleGift(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  if (!interaction.guildId) {
    const embed = EmbedFactory.CreateError({
      title: "Server Only",
      description: "Gifts can only be sent inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: false,
    });
    return;
  }

  if (amount <= 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "Invalid Amount",
      description: "Gift amount must be greater than zero.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: false,
    });
    return;
  }

  if (targetUser.id === interaction.user.id) {
    const embed = EmbedFactory.CreateWarning({
      title: "Cannot Gift Yourself",
      description: "Choose a different user to send coins to.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: false,
    });
    return;
  }

  if (targetUser.bot) {
    const embed = EmbedFactory.CreateWarning({
      title: "Bots Cannot Receive Gifts",
      description: "Select a human user to send coins to.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: false,
    });
    return;
  }

  const manager = new EconomyManager(interaction.guildId, context.databases.userDb);

  try {
    const transfer = manager.TransferBalance({
      fromUserId: interaction.user.id,
      toUserId: targetUser.id,
      amount,
      minBalance: 0,
    });

    if (!transfer.success) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Enough Coins",
        description: "You don't have enough coins to send that amount.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: false,
      });
      return;
    }

    const embed = BuildGiftSuccessEmbed({
      senderId: interaction.user.id,
      recipientId: targetUser.id,
      amount,
      senderBalance: transfer.fromBalance,
      recipientBalance: transfer.toBalance,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: false,
    });
  } finally {
  }
}


