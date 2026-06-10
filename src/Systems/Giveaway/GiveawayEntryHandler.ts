import { MessageFlags } from "discord.js";
import { CommandContext } from "@commands";
import { EmbedFactory, ToEmbedData } from "@utilities";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import {
  GuildTextChannel,
  UpdateEntryCount,
} from "@commands/Utility/Giveaway/GiveawayShared";

export function RegisterGiveawayEntryHandler(options: {
  customId: string;
  expiresInMs: number;
  manager: GiveawayManager;
  channel: GuildTextChannel;
  giveawayMessageId: string;
  context: CommandContext;
}): void {
  const {
    customId,
    expiresInMs,
    manager,
    channel,
    giveawayMessageId,
    context,
  } = options;

  context.responders.componentRouter.RegisterButton({
    customId,
    expiresInMs,
    handler: async (buttonInteraction) => {
      const giveawayData = manager.GetGiveaway(giveawayMessageId);

      if (!giveawayData || giveawayData.ended) {
        const endedEmbed = EmbedFactory.CreateWarning({
          title: "Giveaway Ended",
          description: "This giveaway has already ended.",
        });
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [ToEmbedData(endedEmbed)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (giveawayData.ends_at <= Date.now()) {
        const { winners, entryCount } = await manager.FinalizeGiveaway(
          giveawayData,
          channel,
        );
        const winnerMentions =
          winners.length > 0
            ? winners.map((id) => `<@${id}>`).join(", ")
            : "No winners";
        const endedEmbed = EmbedFactory.CreateWarning({
          title: "Giveaway Ended",
          description: [
            `**Prize:** ${giveawayData.prize}`,
            `**Winners:** ${winnerMentions}`,
            `**Total Entries:** ${entryCount}`,
          ].join("\n"),
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [ToEmbedData(endedEmbed)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const hasEntered = manager.HasEntered(
        giveawayData.id,
        buttonInteraction.user.id,
      );

      if (hasEntered) {
        manager.LeaveGiveaway(giveawayData.id, buttonInteraction.user.id);
        const newCount = manager.GetEntryCount(giveawayData.id);

        const leftEmbed = EmbedFactory.CreateWarning({
          title: "Left Giveaway",
          description: `You have left the giveaway for **${giveawayData.prize}**.`,
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [ToEmbedData(leftEmbed)],
          flags: MessageFlags.Ephemeral,
        });

        await UpdateEntryCount(
          channel,
          giveawayMessageId,
          manager,
          giveawayData,
          newCount,
          false,
        );
      } else {
        manager.EnterGiveaway(giveawayData.id, buttonInteraction.user.id);
        const newCount = manager.GetEntryCount(giveawayData.id);

        const enteredEmbed = EmbedFactory.CreateSuccess({
          title: "Entered Giveaway",
          description: `🎉 You have entered the giveaway for **${giveawayData.prize}**! Click again to leave.`,
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [ToEmbedData(enteredEmbed)],
          flags: MessageFlags.Ephemeral,
        });

        await UpdateEntryCount(
          channel,
          giveawayMessageId,
          manager,
          giveawayData,
          newCount,
          true,
        );
      }
    },
  });
}
