import type {
  CategoryChannel,
  ChatInputCommandInteraction,
  Role,
  TextChannel,
} from "discord.js";
import { ChannelType } from "discord.js";
import type { GuildSettings } from "@database/ServerDatabase";
import type { GuildXpSettings } from "@database/Server/Types";
import type { FeatureModuleId } from "./features/FeatureModules";

export interface SetupDraft {
  adminRoleIds: string[];
  modRoleIds: string[];
  ticketCategoryId: string | null;
  appealReviewCategoryId: string | null;
  commandLogChannelId: string | null;
  ticketLogChannelId: string | null;
  announcementChannelId: string | null;
  deleteLogChannelId: string | null;
  productionLogChannelId: string | null;
  welcomeChannelId: string | null;
  economyEnabled: boolean;
  levelingEnabled: boolean;
  starboardEnabled: boolean;
  verificationEnabled: boolean;
  giveawaysEnabled: boolean;
  starboardChannelId: string | null;
  levelUpChannelId: string | null;
  verificationChannelId: string | null;
  unverifiedRoleId: string | null;
  verifiedRoleId: string | null;
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
  appealSelect: string;
  commandLogSelect: string;
  ticketLogSelect: string;
  deleteLogSelect: string;
  productionLogSelect: string;
  announcementSelect: string;
  welcomeSelect: string;
  starboardChannelSelect: string;
  levelUpChannelSelect: string;
  verificationChannelSelect: string;
  unverifiedRoleSelect: string;
  verifiedRoleSelect: string;
  featureToggleIds: Record<FeatureModuleId, string>;
  next: string;
  back: string;
  saveAndQuit: string;
  cancel: string;
}

export interface StepState {
  current: number;
}

export function CreateNavigationIds(interactionId: string): NavigationIds {
  const prefix = `setup:${interactionId}`;
  return {
    adminSelect: `${prefix}:admin`,
    modSelect: `${prefix}:mod`,
    ticketSelect: `${prefix}:ticket`,
    appealSelect: `${prefix}:appeal`,
    commandLogSelect: `${prefix}:cmdlog`,
    ticketLogSelect: `${prefix}:ticketlog`,
    deleteLogSelect: `${prefix}:deletelog`,
    productionLogSelect: `${prefix}:prodlog`,
    announcementSelect: `${prefix}:announce`,
    welcomeSelect: `${prefix}:welcome`,
    starboardChannelSelect: `${prefix}:starboard`,
    levelUpChannelSelect: `${prefix}:levelup`,
    verificationChannelSelect: `${prefix}:verifychannel`,
    unverifiedRoleSelect: `${prefix}:unverifiedrole`,
    verifiedRoleSelect: `${prefix}:verifiedrole`,
    featureToggleIds: {
      economy: `${prefix}:feat:economy`,
      leveling: `${prefix}:feat:leveling`,
      starboard: `${prefix}:feat:starboard`,
      verification: `${prefix}:feat:verification`,
      giveaways: `${prefix}:feat:giveaways`,
    },
    next: `${prefix}:next`,
    back: `${prefix}:back`,
    saveAndQuit: `${prefix}:savequit`,
    cancel: `${prefix}:cancel`,
  };
}

export function BuildDraftFromSettings(
  settings: GuildSettings,
  xpSettings: GuildXpSettings,
): SetupDraft {
  return {
    adminRoleIds: [...settings.admin_role_ids],
    modRoleIds: [...settings.mod_role_ids],
    ticketCategoryId: settings.ticket_category_id,
    appealReviewCategoryId: settings.appeal_review_category_id,
    commandLogChannelId: settings.command_log_channel_id,
    ticketLogChannelId: settings.ticket_log_channel_id,
    announcementChannelId: settings.announcement_channel_id,
    deleteLogChannelId: settings.delete_log_channel_id,
    productionLogChannelId: settings.production_log_channel_id,
    welcomeChannelId: settings.welcome_channel_id,
    economyEnabled: settings.economy_enabled,
    levelingEnabled: xpSettings.enabled,
    starboardEnabled: settings.starboard_channel_id !== null,
    verificationEnabled: settings.verification_enabled,
    giveawaysEnabled: settings.giveaways_enabled,
    starboardChannelId: settings.starboard_channel_id,
    levelUpChannelId: xpSettings.level_up_channel_id,
    verificationChannelId: settings.verification_channel_id,
    unverifiedRoleId: settings.unverified_role_id,
    verifiedRoleId: settings.verified_role_id,
  };
}

export function CreateEmptySettings(guild_id: string): GuildSettings {
  return {
    guild_id,
    admin_role_ids: [],
    mod_role_ids: [],
    ticket_category_id: null,
    appeal_review_category_id: null,
    command_log_channel_id: null,
    ticket_log_channel_id: null,
    announcement_channel_id: null,
    delete_log_channel_id: null,
    production_log_channel_id: null,
    welcome_channel_id: null,
    autorole_id: null,
    starboard_channel_id: null,
    starboard_emoji: "⭐",
    starboard_threshold: 3,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
    verification_enabled: false,
    unverified_role_id: null,
    verified_role_id: null,
    verification_min_account_age_days: 0,
    verification_channel_id: null,
    economy_enabled: true,
    giveaways_enabled: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export async function SanitizeGuildSettings(
  guild: ChatInputCommandInteraction["guild"],
  settings: GuildSettings,
): Promise<GuildSettings> {
  const ticketCategoryId = await ResolveExistingChannelId(
    guild,
    settings.ticket_category_id,
    ChannelType.GuildCategory,
  );

  const appealReviewCategoryId = await ResolveExistingChannelId(
    guild,
    settings.appeal_review_category_id,
    ChannelType.GuildCategory,
  );

  const commandLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.command_log_channel_id,
    ChannelType.GuildText,
  );

  const ticketLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.ticket_log_channel_id,
    ChannelType.GuildText,
  );

  const announcementChannelId = await ResolveExistingChannelId(
    guild,
    settings.announcement_channel_id,
    ChannelType.GuildText,
  );

  const deleteLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.delete_log_channel_id,
    ChannelType.GuildText,
  );

  const productionLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.production_log_channel_id,
    ChannelType.GuildText,
  );

  const welcomeChannelId = await ResolveExistingChannelId(
    guild,
    settings.welcome_channel_id,
    ChannelType.GuildText,
  );

  const starboardChannelId = await ResolveExistingChannelId(
    guild,
    settings.starboard_channel_id,
    ChannelType.GuildText,
  );

  const verificationChannelId = await ResolveExistingChannelId(
    guild,
    settings.verification_channel_id,
    ChannelType.GuildText,
  );

  const unverifiedRoleId = await ResolveExistingRoleId(
    guild,
    settings.unverified_role_id,
  );

  const verifiedRoleId = await ResolveExistingRoleId(
    guild,
    settings.verified_role_id,
  );

  return {
    ...settings,
    ticket_category_id: ticketCategoryId,
    appeal_review_category_id: appealReviewCategoryId,
    command_log_channel_id: commandLogChannelId,
    ticket_log_channel_id: ticketLogChannelId,
    announcement_channel_id: announcementChannelId,
    delete_log_channel_id: deleteLogChannelId,
    production_log_channel_id: productionLogChannelId,
    welcome_channel_id: welcomeChannelId,
    starboard_channel_id: starboardChannelId,
    verification_channel_id: verificationChannelId,
    unverified_role_id: unverifiedRoleId,
    verified_role_id: verifiedRoleId,
  };
}

export async function ResolveExistingChannelId(
  guild: ChatInputCommandInteraction["guild"],
  channelId: string | null,
  expectedType: ChannelType,
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

export async function ResolveExistingRoleId(
  guild: ChatInputCommandInteraction["guild"],
  roleId: string | null,
): Promise<string | null> {
  if (!roleId) {
    return null;
  }

  try {
    const role = await guild?.roles.fetch(roleId);
    return role ? roleId : null;
  } catch {
    return null;
  }
}
