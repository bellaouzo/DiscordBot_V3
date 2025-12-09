import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  NewsChannel,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { UserDatabase, Giveaway } from "@database";
import { EmbedFactory } from "@utilities";

type GuildTextChannel = TextChannel | NewsChannel | ThreadChannel;

export class GiveawayManager {
  constructor(
    private readonly guildId: string,
    private readonly userDb: UserDatabase
  ) {}

  CreateGiveawayMessage(data: {
    prize: string;
    endsAt: number;
    winnerCount: number;
    hostId: string;
    entryCount?: number;
  }): {
    embed: EmbedBuilder;
    row: ActionRowBuilder<ButtonBuilder>;
    customId: string;
  } {
    const customId = `giveaway_enter_${Date.now()}`;
    const timeRemaining = Math.floor(data.endsAt / 1000);

    const embed = EmbedFactory.Create({
      title: "🎉 GIVEAWAY 🎉",
      description: [
        `**Prize:** ${data.prize}`,
        ``,
        `**Winners:** ${data.winnerCount}`,
        `**Ends:** <t:${timeRemaining}:R>`,
        `**Hosted by:** <@${data.hostId}>`,
        ``,
        `Click the button below to enter!`,
      ].join("\n"),
      color: 0x9b59b6,
      footer: `${data.entryCount ?? 0} entries`,
    });

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel("🎉 Enter Giveaway")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    return { embed, row, customId };
  }

  CreateEndedEmbed(data: {
    prize: string;
    winners: string[];
    hostId: string;
    entryCount: number;
  }): EmbedBuilder {
    const winnerMentions =
      data.winners.length > 0
        ? data.winners.map((id) => `<@${id}>`).join(", ")
        : "No valid entries";

    const embed = EmbedFactory.Create({
      title: "🎉 GIVEAWAY ENDED 🎉",
      description: [
        `**Prize:** ${data.prize}`,
        ``,
        `**Winner${data.winners.length !== 1 ? "s" : ""}:** ${winnerMentions}`,
        `**Hosted by:** <@${data.hostId}>`,
      ].join("\n"),
      color: 0x2ecc71,
      footer: `${data.entryCount} total entries`,
    });

    return embed;
  }

  SaveGiveaway(data: {
    channelId: string;
    messageId: string;
    hostId: string;
    prize: string;
    winnerCount: number;
    endsAt: number;
  }): Giveaway {
    return this.userDb.CreateGiveaway({
      guild_id: this.guildId,
      channel_id: data.channelId,
      message_id: data.messageId,
      host_id: data.hostId,
      prize: data.prize,
      winner_count: data.winnerCount,
      ends_at: data.endsAt,
    });
  }

  GetGiveaway(messageId: string): Giveaway | null {
    return this.userDb.GetGiveawayByMessageId(messageId);
  }

  GetActiveGiveaways(): Giveaway[] {
    return this.userDb.GetActiveGiveaways(this.guildId);
  }

  EnterGiveaway(giveawayId: number, userId: string): boolean {
    return this.userDb.AddGiveawayEntry(giveawayId, userId);
  }

  LeaveGiveaway(giveawayId: number, userId: string): boolean {
    return this.userDb.RemoveGiveawayEntry(giveawayId, userId);
  }

  HasEntered(giveawayId: number, userId: string): boolean {
    return this.userDb.HasEnteredGiveaway(giveawayId, userId);
  }

  GetEntryCount(giveawayId: number): number {
    return this.userDb.GetGiveawayEntryCount(giveawayId);
  }

  GetEntries(giveawayId: number): string[] {
    return this.userDb.GetGiveawayEntries(giveawayId);
  }

  SelectWinners(giveawayId: number, count: number): string[] {
    const entries = this.GetEntries(giveawayId);
    if (entries.length === 0) return [];

    const winners: string[] = [];
    const shuffled = [...entries].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      winners.push(shuffled[i]);
    }

    return winners;
  }

  EndGiveaway(messageId: string, winnerIds: string[]): boolean {
    return this.userDb.EndGiveaway(messageId, winnerIds);
  }

  async UpdateEndedMessage(
    channel: GuildTextChannel,
    messageId: string,
    giveaway: Giveaway,
    winners: string[],
    entryCount: number
  ): Promise<void> {
    try {
      const message = await channel.messages.fetch(messageId);
      const embed = this.CreateEndedEmbed({
        prize: giveaway.prize,
        winners,
        hostId: giveaway.host_id,
        entryCount,
      });

      const disabledButton = new ButtonBuilder()
        .setCustomId("giveaway_ended")
        .setLabel("Giveaway Ended")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        disabledButton
      );

      await message.edit({
        embeds: [embed.toJSON()],
        components: [row],
      });
    } catch {
      // Message may have been deleted
    }
  }

  async AnnounceWinners(
    channel: GuildTextChannel,
    giveaway: Giveaway,
    winners: string[]
  ): Promise<void> {
    if (winners.length === 0) {
      const embed = EmbedFactory.CreateWarning({
        title: "Giveaway Ended",
        description: `Giveaway for **${giveaway.prize}** ended, but there were no valid entries.`,
      });

      await channel.send({
        embeds: [embed.toJSON()],
      });
      return;
    }

    const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
    const embed = EmbedFactory.CreateSuccess({
      title: "🎉 Giveaway Winners",
      description: [
        `**Prize:** ${giveaway.prize}`,
        `**Winner${winners.length !== 1 ? "s" : ""}:** ${winnerMentions}`,
        `**Hosted by:** <@${giveaway.host_id}>`,
      ].join("\n"),
    });

    await channel.send({
      embeds: [embed.toJSON()],
    });
  }

  async FinalizeGiveaway(
    giveaway: Giveaway,
    channel?: GuildTextChannel
  ): Promise<{ winners: string[]; entryCount: number }> {
    const winners = this.SelectWinners(giveaway.id, giveaway.winner_count);
    const entryCount = this.GetEntryCount(giveaway.id);

    this.EndGiveaway(giveaway.message_id, winners);

    if (channel) {
      await this.UpdateEndedMessage(
        channel,
        giveaway.message_id,
        giveaway,
        winners,
        entryCount
      );
      await this.AnnounceWinners(channel, giveaway, winners);
    }

    return { winners, entryCount };
  }
}
