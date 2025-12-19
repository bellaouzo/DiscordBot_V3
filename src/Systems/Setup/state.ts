import {
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  Role,
  TextChannel,
} from "discord.js";
import { GuildSettings } from "@database/ServerDatabase";

export interface SetupDraft {
  adminRoleIds: string[];
  modRoleIds: string[];
  ticketCategoryId: string | null;
  commandLogChannelId: string | null;
  announcementChannelId: string | null;
  deleteLogChannelId: string | null;
  productionLogChannelId: string | null;
  welcomeChannelId: string | null;
}

export interface SetupResources {
  roles: Role[];
  categories: CategoryChannel[];
  textChannels: TextChannel[];
}

export interface NavigationIds {
  adminSelect: string;
  modSelect: string;
  ticketSelect: string;
  commandLogSelect: string;
  deleteLogSelect: string;
  productionLogSelect: string;
  announcementSelect: string;
  welcomeSelect: string;
  next: string;
  back: string;
  save: string;
  saveAndQuit: string;
  cancel: string;
}

export interface StepState {
  current: number;
}

export function CreateEmptySettings(guild_id: string): GuildSettings {
  return {
    guild_id,
    admin_role_ids: [],
    mod_role_ids: [],
    ticket_category_id: null,
    command_log_channel_id: null,
    announcement_channel_id: null,
    delete_log_channel_id: null,
    production_log_channel_id: null,
    welcome_channel_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export async function SanitizeGuildSettings(
  guild: ChatInputCommandInteraction["guild"],
  settings: GuildSettings
): Promise<GuildSettings> {
  const ticketCategoryId = await ResolveExistingChannelId(
    guild,
    settings.ticket_category_id,
    ChannelType.GuildCategory
  );

  const commandLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.command_log_channel_id,
    ChannelType.GuildText
  );

  const announcementChannelId = await ResolveExistingChannelId(
    guild,
    settings.announcement_channel_id,
    ChannelType.GuildText
  );

  const deleteLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.delete_log_channel_id,
    ChannelType.GuildText
  );

  const productionLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.production_log_channel_id,
    ChannelType.GuildText
  );

  const welcomeChannelId = await ResolveExistingChannelId(
    guild,
    settings.welcome_channel_id,
    ChannelType.GuildText
  );

  return {
    ...settings,
    ticket_category_id: ticketCategoryId,
    command_log_channel_id: commandLogChannelId,
    announcement_channel_id: announcementChannelId,
    delete_log_channel_id: deleteLogChannelId,
    production_log_channel_id: productionLogChannelId,
    welcome_channel_id: welcomeChannelId,
  };
}

export async function ResolveExistingChannelId(
  guild: ChatInputCommandInteraction["guild"],
  channelId: string | null,
  expectedType: ChannelType
): Promise<string | null> {
  if (!channelId) {
    return null;
  }

  try {
    const channel = await guild?.channels.fetch(channelId);
    if (!channel || channel.type !== expectedType) {
      return null;
    }
    return channelId;
  } catch {
    return null;
  }
}
