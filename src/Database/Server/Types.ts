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

export interface GuildSettings {
  guild_id: string;
  admin_role_ids: string[];
  mod_role_ids: string[];
  ticket_category_id: string | null;
  appeal_review_category_id: string | null;
  command_log_channel_id: string | null;
  ticket_log_channel_id: string | null;
  announcement_channel_id: string | null;
  delete_log_channel_id: string | null;
  production_log_channel_id: string | null;
  welcome_channel_id: string | null;
  autorole_id: string | null;
  starboard_channel_id: string | null;
  starboard_emoji: string;
  starboard_threshold: number;
  roblox_linked_discord_user_id: string | null;
  roblox_linked_at: number | null;
  created_at: number;
  updated_at: number;
}

export type GuildSettingsRow = {
  guild_id: string;
  admin_role_ids: string;
  mod_role_ids: string;
  ticket_category_id: string | null;
  appeal_review_category_id?: string | null;
  command_log_channel_id: string | null;
  ticket_log_channel_id?: string | null;
  announcement_channel_id: string | null;
  delete_log_channel_id: string | null;
  production_log_channel_id: string | null;
  welcome_channel_id?: string | null;
  autorole_id?: string | null;
  starboard_channel_id?: string | null;
  starboard_emoji?: string | null;
  starboard_threshold?: number | null;
  roblox_linked_discord_user_id?: string | null;
  roblox_linked_at?: number | null;
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
