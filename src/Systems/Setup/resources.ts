import type {
  CategoryChannel,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { ChannelType } from "discord.js";
import type { SetupResources } from "./state";

export function CollectResources(
  guild: ChatInputCommandInteraction["guild"],
): SetupResources {
  const roles = guild?.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((first, second) => second.position - first.position);

  const categories = guild?.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .map((channel) => channel as CategoryChannel)
    .sort((a, b) => b.rawPosition - a.rawPosition);

  const textChannels = guild?.channels.cache
    .filter(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        !channel.name.toLowerCase().startsWith("ticket-"),
    )
    .map((channel) => channel as TextChannel)
    .sort((a, b) => b.rawPosition - a.rawPosition);

  return {
    roles: roles ? Array.from(roles.values()) : [],
    categories: categories ?? [],
    textChannels: textChannels ?? [],
  };
}

export function PromoteResourceItem<T extends { id: string }>(
  items: T[],
  item: T,
): void {
  const itemId = String(item.id);
  const existingIndex = items.findIndex(
    (existing) => String(existing.id) === itemId,
  );

  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
  }

  items.unshift(item);
}
