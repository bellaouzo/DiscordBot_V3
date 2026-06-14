import type { APIEmbed } from "discord.js";
import { AllCommands } from "@commands/registry";
import { EmbedFactory } from "@utilities";
import type {
  CategoryView,
  CommandInfo,
} from "@commands/Utility/Help/HelpTypes";
import { CACHE_DURATION, commandCache } from "@commands/Utility/Help/HelpTypes";

export async function GetAllCommandsCached(
  guildId?: string,
  isCommandDisabled?: (guildId: string, commandName: string) => boolean,
): Promise<CommandInfo[]> {
  const cacheKey = guildId ? `all-commands:${guildId}` : "all-commands";
  const cached = commandCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  let commands = AllCommands().map((cmd) => ({
    name: cmd.data.name,
    description: cmd.data.description,
    group: cmd.group,
  }));

  if (guildId && isCommandDisabled) {
    commands = commands.filter((cmd) => !isCommandDisabled(guildId, cmd.name));
  }

  commandCache.set(cacheKey, { data: commands, timestamp: Date.now() });
  return commands;
}

export function BuildCategoryViews(commands: CommandInfo[]): CategoryView[] {
  const groups = new Map<string, CommandInfo[]>();

  commands.forEach((command) => {
    const group = command.group;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)?.push(command);
  });

  const categories: CategoryView[] = [];

  groups.forEach((groupCommands, key) => {
    const sortedCommands = [...groupCommands].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    categories.push({
      key,
      name: FormatGroupName(key),
      description: GetGroupDescription(key),
      icon: GetGroupIcon(key),
      commands: sortedCommands,
      pages: CreateCategoryPages({
        key,
        name: FormatGroupName(key),
        description: GetGroupDescription(key),
        icon: GetGroupIcon(key),
        commands: sortedCommands,
      }),
    });
  });

  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

export function CreateCategoryPages(
  category: Pick<
    CategoryView,
    "key" | "name" | "description" | "icon" | "commands"
  >,
): APIEmbed[] {
  if (category.commands.length === 0) {
    const emptyEmbed = EmbedFactory.CreateHelpSection(
      category.name,
      category.description,
      0,
    );
    emptyEmbed.addFields({
      name: "🚫 No Commands",
      value: "This category currently has no available commands.",
      inline: false,
    });
    return [emptyEmbed.toJSON()];
  }

  const commandChunks = ChunkArray(category.commands, 8);

  return commandChunks.map((chunk, index) => {
    const embed = EmbedFactory.CreateHelpSection(
      category.name,
      category.description,
      category.commands.length,
    );

    const commandList = chunk
      .map((command) => `\`/${command.name}\` — ${command.description}`)
      .join("\n");

    embed.addFields({
      name: index === 0 ? "📋 Available Commands" : "📋 Commands (continued)",
      value: commandList,
      inline: false,
    });

    return embed.toJSON();
  });
}

export function FormatGroupName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

export function GetGroupDescription(group: string): string {
  const descriptions: Record<string, string> = {
    utility: "🔧 General utility commands for everyday use",
    moderation: "🛡️ Commands for moderating the server",
    admin: "⚙️ Administrative commands for server management",
    fun: "🎮 Fun and entertainment commands",
    info: "📊 Information and lookup commands",
    music: "🎵 Music and audio commands",
    economy: "💰 Economy and currency commands",
    games: "🎲 Gaming and interactive commands",
  };
  return descriptions[group] ?? "📦 Commands for this category";
}

export function GetGroupIcon(group: string): string {
  const icons: Record<string, string> = {
    utility: "🔧",
    moderation: "🛡️",
    admin: "⚙️",
    fun: "🎮",
    info: "📊",
    music: "🎵",
    economy: "💰",
    games: "🎲",
  };
  return icons[group] ?? "📦";
}

export function ChunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
