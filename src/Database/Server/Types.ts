export interface ScheduledEvent {
  id: number;
  guild_id: string;
  guild_event_id: number;
  title: string;
  scheduled_at: number;
  should_notify: boolean;
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
  roblox_linked_discord_user_id?: string | null;
  roblox_linked_at?: number | null;
  created_at: number;
  updated_at: number;
};

export type EventRow = {
  id: number;
  guild_id: string;
  guild_event_id: number | null;
  title: string;
  scheduled_at: number;
  should_notify: number;
  created_by: string;
  created_at: number;
};
