import { SafeParseJson, isStringArray } from "@utilities/SafeJson";
import type { Logger } from "@shared/Logger";
import type {
  EventRow,
  GuildSettings,
  GuildSettingsRow,
  ScheduledEvent,
} from "@database/Server/Types";

export function MapScheduledEvent(
  row: EventRow,
  fallbackGuildEventId?: number,
): ScheduledEvent {
  return {
    id: row.id,
    guild_id: row.guild_id,
    guild_event_id: row.guild_event_id ?? fallbackGuildEventId ?? row.id,
    title: row.title,
    scheduled_at: row.scheduled_at,
    should_notify: Boolean(row.should_notify),
    notified_at:
      row.notified_at !== null && row.notified_at !== undefined
        ? Number(row.notified_at)
        : null,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function ParseIdList(
  value: string | null | undefined,
  logger?: Logger,
): string[] {
  if (!value) {
    return [];
  }

  const result = SafeParseJson(value, isStringArray);
  if (!result.success || !result.data) {
    if (result.error && logger) {
      logger.Warn("Failed to parse guild settings id list", {
        error: result.error,
      });
    }
    return [];
  }

  return result.data
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

export function NormalizeIds(ids: string[]): string[] {
  const unique = new Set<string>();
  ids.forEach((id) => {
    const normalized = String(id).trim();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
}

export function MapGuildSettings(
  row: GuildSettingsRow,
  logger?: Logger,
): GuildSettings {
  return {
    guild_id: String(row.guild_id),
    admin_role_ids: ParseIdList(row.admin_role_ids, logger),
    mod_role_ids: ParseIdList(row.mod_role_ids, logger),
    ticket_category_id: row.ticket_category_id
      ? String(row.ticket_category_id)
      : null,
    appeal_review_category_id: row.appeal_review_category_id
      ? String(row.appeal_review_category_id)
      : null,
    command_log_channel_id: row.command_log_channel_id
      ? String(row.command_log_channel_id)
      : null,
    ticket_log_channel_id: row.ticket_log_channel_id
      ? String(row.ticket_log_channel_id)
      : null,
    announcement_channel_id: row.announcement_channel_id
      ? String(row.announcement_channel_id)
      : null,
    delete_log_channel_id: row.delete_log_channel_id
      ? String(row.delete_log_channel_id)
      : null,
    production_log_channel_id: row.production_log_channel_id
      ? String(row.production_log_channel_id)
      : null,
    welcome_channel_id: row.welcome_channel_id
      ? String(row.welcome_channel_id)
      : null,
    autorole_id: row.autorole_id ? String(row.autorole_id) : null,
    starboard_channel_id: row.starboard_channel_id
      ? String(row.starboard_channel_id)
      : null,
    starboard_emoji: row.starboard_emoji ? String(row.starboard_emoji) : "⭐",
    starboard_threshold:
      row.starboard_threshold !== null && row.starboard_threshold !== undefined
        ? Number(row.starboard_threshold)
        : 3,
    roblox_linked_discord_user_id: row.roblox_linked_discord_user_id
      ? String(row.roblox_linked_discord_user_id)
      : null,
    roblox_linked_at:
      row.roblox_linked_at !== null && row.roblox_linked_at !== undefined
        ? Number(row.roblox_linked_at)
        : null,
    verification_enabled: Boolean(row.verification_enabled),
    unverified_role_id: row.unverified_role_id
      ? String(row.unverified_role_id)
      : null,
    verified_role_id: row.verified_role_id
      ? String(row.verified_role_id)
      : null,
    verification_min_account_age_days:
      row.verification_min_account_age_days !== null &&
      row.verification_min_account_age_days !== undefined
        ? Number(row.verification_min_account_age_days)
        : 0,
    verification_channel_id: row.verification_channel_id
      ? String(row.verification_channel_id)
      : null,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}
