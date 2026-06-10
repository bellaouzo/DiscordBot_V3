import { EmbedFactory } from "@utilities";

export function BuildGiftSuccessEmbed(options: {
  senderId: string;
  recipientId: string;
  amount: number;
  senderBalance: number;
  recipientBalance: number;
}): ReturnType<typeof EmbedFactory.CreateSuccess> {
  return EmbedFactory.CreateSuccess({
    title: "🎁 Gift Sent",
    description: `You sent **${options.amount}** coins to <@${options.recipientId}>.\nYour balance: **${options.senderBalance}**\nRecipient balance: **${options.recipientBalance}**`,
    footer: `Sender: ${options.senderId}`,
  });
}
