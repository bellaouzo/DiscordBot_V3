import type {
  Client,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  TextChannel,
  User,
} from "discord.js";
import type { ServerDatabase } from "@database";
import type { StarboardEntry } from "@database/Server/Types";
import type { Logger } from "@shared/Logger";
import { EmbedFactory, ReactionMatchesEmoji } from "@utilities";

type StarboardSettings = {
  starboard_channel_id: string;
  starboard_emoji: string;
  starboard_threshold: number;
};

export class StarboardManager {
  constructor(
    private readonly client: Client,
    private readonly serverDb: ServerDatabase,
    private readonly logger: Logger,
  ) {}

  async HandleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    const resolvedUser = user.partial ? await user.fetch() : user;
    if (resolvedUser.bot) {
      return;
    }

    const resolvedReaction = await this.ResolveReaction(reaction);
    if (!resolvedReaction) {
      return;
    }

    const message = await this.ResolveMessage(resolvedReaction.message);
    if (!message) {
      return;
    }

    const settings = this.GetStarboardSettings(message);
    if (!settings) {
      return;
    }

    if (!ReactionMatchesEmoji(resolvedReaction, settings.starboard_emoji)) {
      return;
    }

    await this.SyncStarboardState(message, settings);
  }

  async HandleReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
  ): Promise<void> {
    const resolvedReaction = await this.ResolveReaction(reaction);
    if (!resolvedReaction) {
      return;
    }

    const message = await this.ResolveMessage(resolvedReaction.message);
    if (!message) {
      return;
    }

    const settings = this.GetStarboardSettings(message);
    if (!settings) {
      return;
    }

    if (!ReactionMatchesEmoji(resolvedReaction, settings.starboard_emoji)) {
      return;
    }

    await this.SyncStarboardState(message, settings);
  }

  private async ResolveReaction(
    reaction: MessageReaction | PartialMessageReaction,
  ): Promise<MessageReaction | null> {
    if (!reaction.partial) {
      return reaction;
    }

    const resolved = await reaction.fetch().catch(() => null);
    if (!resolved) {
      this.logger.Warn("Failed to fetch partial reaction");
    }

    return resolved;
  }

  private async ResolveMessage(
    message: Message | PartialMessage,
  ): Promise<Message | null> {
    if (!message.partial) {
      return message;
    }

    const resolved = await message.fetch().catch(() => null);
    if (!resolved) {
      this.logger.Warn("Failed to fetch partial starboard message");
    }

    return resolved;
  }

  private GetStarboardSettings(message: Message): StarboardSettings | null {
    if (!message.guild || message.author?.bot) {
      return null;
    }

    const settings = this.serverDb.GetGuildSettings(message.guild.id);
    if (!settings?.starboard_channel_id) {
      return null;
    }

    if (message.channel.id === settings.starboard_channel_id) {
      return null;
    }

    return {
      starboard_channel_id: settings.starboard_channel_id,
      starboard_emoji: settings.starboard_emoji,
      starboard_threshold: settings.starboard_threshold,
    };
  }

  private async SyncStarboardState(
    message: Message,
    settings: StarboardSettings,
  ): Promise<void> {
    const resolvedMessage = message.partial ? await message.fetch() : message;
    if (!resolvedMessage.guild) {
      return;
    }

    const starCount = await this.CountMatchingReactionsOnMessage(
      resolvedMessage,
      settings.starboard_emoji,
    );
    const existing = this.serverDb.GetStarboardEntry(
      resolvedMessage.guild.id,
      resolvedMessage.id,
    );

    if (existing) {
      if (starCount < settings.starboard_threshold) {
        await this.RemoveFromStarboard(
          resolvedMessage.guild.id,
          existing,
          settings.starboard_channel_id,
        );
        return;
      }

      await this.UpdateStarboardMessage(
        existing.starboard_message_id,
        starCount,
      );
      this.serverDb.UpdateStarboardEntryCount(
        resolvedMessage.guild.id,
        resolvedMessage.id,
        starCount,
      );
      return;
    }

    if (starCount >= settings.starboard_threshold) {
      await this.PostToStarboard(
        resolvedMessage,
        settings.starboard_channel_id,
        starCount,
      );
    }
  }

  private async CountMatchingReactionsOnMessage(
    message: Message,
    configuredEmoji: string,
  ): Promise<number> {
    const resolvedMessage = message.partial ? await message.fetch() : message;

    for (const [, value] of resolvedMessage.reactions.cache) {
      if (ReactionMatchesEmoji(value, configuredEmoji)) {
        return value.count;
      }
    }

    return 0;
  }

  private async PostToStarboard(
    message: Message,
    starboardChannelId: string,
    starCount: number,
  ): Promise<void> {
    if (!message.guild) {
      return;
    }

    const channel = await this.client.channels.fetch(starboardChannelId);
    if (!channel?.isTextBased()) {
      return;
    }

    const embed = this.BuildStarboardEmbed(message, starCount);
    const posted = await (channel as TextChannel).send({
      embeds: [embed.toJSON()],
    });

    this.serverDb.CreateStarboardEntry({
      guild_id: message.guild.id,
      source_channel_id: message.channel.id,
      source_message_id: message.id,
      starboard_message_id: posted.id,
      star_count: starCount,
    });
  }

  private async RemoveFromStarboard(
    guildId: string,
    entry: StarboardEntry,
    starboardChannelId: string,
  ): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (guild) {
        const channel = await guild.channels.fetch(starboardChannelId);
        if (channel?.isTextBased()) {
          const starboardMessage = await (channel as TextChannel).messages
            .fetch(entry.starboard_message_id)
            .catch(() => null);

          if (starboardMessage) {
            await starboardMessage.delete().catch(() => null);
          }
        }
      }
    } catch (error) {
      this.logger.Warn("Failed to delete starboard message", { error });
    }

    this.serverDb.DeleteStarboardEntry(guildId, entry.source_message_id);
  }

  private async UpdateStarboardMessage(
    starboardMessageId: string,
    starCount: number,
  ): Promise<void> {
    try {
      for (const [, guild] of this.client.guilds.cache) {
        const settings = this.serverDb.GetGuildSettings(guild.id);
        if (!settings?.starboard_channel_id) {
          continue;
        }

        const channel = await guild.channels.fetch(
          settings.starboard_channel_id,
        );
        if (!channel?.isTextBased()) {
          continue;
        }

        try {
          const starboardMessage = await (
            channel as TextChannel
          ).messages.fetch(starboardMessageId);
          const embed = starboardMessage.embeds[0];
          if (!embed) {
            return;
          }

          const updated = EmbedFactory.Create({
            title: embed.title ?? "Starboard",
            description: embed.description ?? "",
            color: embed.color ?? 0xf1c40f,
            thumbnail: embed.thumbnail?.url,
            image: embed.image?.url,
            footer: `${starCount} stars`,
          });
          if (embed.url) {
            updated.setURL(embed.url);
          }

          await starboardMessage.edit({ embeds: [updated.toJSON()] });
          return;
        } catch {
          continue;
        }
      }
    } catch (error) {
      this.logger.Warn("Failed to update starboard message", { error });
    }
  }

  private BuildStarboardEmbed(message: Message, starCount: number) {
    const content = message.content?.trim() || "*No text content*";
    const snippet =
      content.length > 300 ? `${content.slice(0, 297)}...` : content;

    const embed = EmbedFactory.Create({
      title: "⭐ Starboard",
      description: snippet,
      color: 0xf1c40f,
      footer: `${starCount} stars`,
      timestamp: true,
    });
    embed.setURL(message.url);

    embed.setAuthor({
      name: message.author?.displayName ?? "Unknown",
      iconURL: message.author?.displayAvatarURL(),
    });

    const attachment = message.attachments.first();
    if (attachment?.contentType?.startsWith("image/")) {
      embed.setImage(attachment.url);
    }

    embed.addFields({
      name: "Source",
      value: `[Jump to message](${message.url})`,
      inline: true,
    });

    return embed;
  }
}
