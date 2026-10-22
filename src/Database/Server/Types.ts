import type { GuildSettingValues } from "@database/Server/GuildSettingsSchema";

export interface ScheduledEvent {
  id: number;
  guild_id: string;
  guild_event_id: number;
  title: string;
  scheduled_at: number;
  should_notify: boolean;
  notified_at: number | null;
  created_by: string;
  created_at: number;
}

/** Stored guild settings. Fields come from `GUILD_SETTING_FIELDS` in GuildSettingsSchema.ts. */
export interface GuildSettings extends GuildSettingValues {
  guild_id: string;
  created_at: number;
  updated_at: number;
}

export interface LevelRoleReward {
  guild_id: string;
  level: number;
  role_id: string;
}

export type GuildSettingsRow = Record<string, unknown> & {
  guild_id: string;
  created_at: number;
  updated_at: number;
};

export interface ReactionRolePanel {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  created_by: string;
  created_at: number;
}

export interface ReactionRoleMapping {
  id: number;
  panel_id: number;
  emoji: string;
  role_id: string;
}

export interface StarboardEntry {
  id: number;
  guild_id: string;
  source_channel_id: string;
  source_message_id: string;
  starboard_message_id: string;
  star_count: number;
  created_at: number;
}

export interface CustomTag {
  id: number;
  guild_id: string;
  name: string;
  content: string;
  created_by: string;
  uses: number;
  created_at: number;
  updated_at: number;
}

export type BlocklistTargetType = "user" | "guild";

/** A user or guild the bot refuses to serve. */
export interface BlocklistEntry {
  target_type: BlocklistTargetType;
  target_id: string;
  reason: string | null;
  created_by: string;
  created_at: number;
}

/** Chat XP settings applied when a guild has not configured its own. */
export const CHAT_XP_DEFAULT_PER_MESSAGE = 15;
export const CHAT_XP_DEFAULT_COOLDOWN_SECONDS = 60;
export const CHAT_XP_DEFAULT_MIN_MESSAGE_LENGTH = 5;
export const CHAT_XP_DEFAULT_DAILY_CAP = 500;

export interface GuildXpSettings {
  guild_id: string;
  enabled: boolean;
  xp_per_message: number;
  cooldown_seconds: number;
  min_message_length: number;
  daily_cap: number;
  excluded_channel_ids: string[];
  level_up_channel_id: string | null;
}

export type GuildXpSettingsRow = {
  guild_id: string;
  enabled: number;
  xp_per_message: number;
  cooldown_seconds: number;
  min_message_length: number;
  daily_cap: number;
  excluded_channel_ids: string;
  level_up_channel_id: string | null;
};

export type EventRow = {
  id: number;
  guild_id: string;
  guild_event_id: number | null;
  title: string;
  scheduled_at: number;
  should_notify: number;
  notified_at?: number | null;
  created_by: string;
  created_at: number;
};
