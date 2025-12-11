import {
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { SetupResources } from "./state";

export function CollectResources(
  guild: ChatInputCommandInteraction["guild"]
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
        !channel.name.toLowerCase().startsWith("ticket-")
    )
    .map((channel) => channel as TextChannel)
    .sort((a, b) => b.rawPosition - a.rawPosition);

  return {
    roles: roles ? Array.from(roles.values()) : [],
    categories: categories ?? [],
    textChannels: textChannels ?? [],
  };
}

