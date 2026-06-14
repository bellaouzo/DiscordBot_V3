import type {
  ChatInputCommandInteraction,
  Role,
  TextChannel,
  CategoryChannel,
} from "discord.js";

export function FormatRoleList(
  roleIds: string[],
  guild: ChatInputCommandInteraction["guild"],
  required = false,
): string {
  if (!roleIds || roleIds.length === 0) {
    return required
      ? "No roles selected (required)"
      : "None selected";
  }

  const mentions = roleIds
    .map((id) => guild?.roles.cache.get(id))
    .filter((role): role is Role => Boolean(role))
    .map((role) => role.toString());

  if (mentions.length === 0) {
    return "Roles not found (they may have been deleted)";
  }

  return mentions.join(", ");
}

export function FormatSingleRole(
  roleId: string | null,
  guild: ChatInputCommandInteraction["guild"],
): string {
  if (!roleId) {
    return "None selected";
  }

  const role = guild?.roles.cache.get(roleId);
  return role ? role.toString() : `Role ID: ${roleId}`;
}

export function FormatCategory(
  categoryId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string,
): string {
  if (!categoryId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const category = guild?.channels.cache.get(categoryId) as
    | CategoryChannel
    | undefined;
  return category
    ? `${category.name} (${categoryId})`
    : `Category ID: ${categoryId}`;
}

export function FormatChannel(
  channelId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string,
): string {
  if (!channelId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const channel = guild?.channels.cache.get(channelId) as
    | TextChannel
    | undefined;
  return channel ? channel.toString() : `Channel ID: ${channelId}`;
}

export function FormatChannelAllowNone(
  channelId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string,
): string {
  if (channelId === null) {
    return "Disabled";
  }

  return FormatChannel(channelId, guild, fallbackName);
}

export function FormatModuleStatus(enabled: boolean): string {
  return enabled ? "🟢 On" : "🔴 Off";
}

export function FormatFeatureModulesOverview(
  modules: readonly {
    emoji: string;
    label: string;
    description: string;
    enabled: boolean;
  }[],
): string {
  return modules
    .map((module) => {
      const status = FormatModuleStatus(module.enabled);
      return [
        `${module.emoji} **${module.label}** · ${status}`,
        module.description,
      ].join("\n");
    })
    .join("\n\n");
}
