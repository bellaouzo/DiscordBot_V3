import {
  Guild,
  CategoryChannel,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  OverwriteResolvable,
} from "discord.js";
import { Logger } from "../Shared/Logger";

export interface ChannelManagerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
}

export interface ChannelManager {
  GetOrCreateCategory(name: string): Promise<CategoryChannel | null>;
  GetOrCreateTextChannel(
    name: string,
    categoryName?: string
  ): Promise<TextChannel | null>;
}

export function CreateChannelManager(
  options: ChannelManagerOptions
): ChannelManager {
  const categoryCache = new Map<string, CategoryChannel | null>();
  const channelCache = new Map<string, TextChannel | null>();

  return {
    GetOrCreateCategory: async (
      name: string
    ): Promise<CategoryChannel | null> => {
      const cached = categoryCache.get(name);
      if (cached !== undefined) {
        return cached;
      }

      const existingCategories = options.guild.channels.cache.filter(
        (channel) =>
          channel.type === ChannelType.GuildCategory && channel.name === name
      );

      if (existingCategories.size > 0) {
        const category = existingCategories.first() as CategoryChannel;
        categoryCache.set(name, category);
        return category;
      }

      try {
        const category = await options.guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
        });

        categoryCache.set(name, category);
        return category;
      } catch (error) {
        options.logger.Error("Failed to create category", {
          error,
          extra: { guildId: options.guild.id, categoryName: name },
        });
        categoryCache.set(name, null);
        return null;
      }
    },

    GetOrCreateTextChannel: async (
      name: string,
      categoryName?: string
    ): Promise<TextChannel | null> => {
      const cacheKey = `${name}:${categoryName || "root"}`;
      const cached = channelCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const existingChannels = options.guild.channels.cache.filter(
        (channel) =>
          channel.type === ChannelType.GuildText && channel.name === name
      );

      if (existingChannels.size > 0) {
        const channel = existingChannels.first() as TextChannel;
        channelCache.set(cacheKey, channel);
        return channel;
      }

      try {
        let parent: CategoryChannel | null = null;
        if (categoryName) {
          parent =
            await CreateChannelManager(options).GetOrCreateCategory(
              categoryName
            );
        }

        const channel = await options.guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: parent,
          permissionOverwrites: CreateDefaultPermissionOverwrites(
            options.guild
          ),
        });

        channelCache.set(cacheKey, channel);

        return channel;
      } catch (error) {
        options.logger.Error("Failed to create text channel", {
          error,
          extra: { guildId: options.guild.id, channelName: name, categoryName },
        });
        channelCache.set(cacheKey, null);
        return null;
      }
    },
  };
}

function CreateDefaultPermissionOverwrites(
  guild: Guild
): OverwriteResolvable[] {
  return [
    {
      id: guild.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
}
