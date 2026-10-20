import { SafeParseJson, isStringArray } from "@utilities/SafeJson";
import type { Logger } from "@shared/Logger";
import { ReadGuildSettingValues } from "@database/Server/GuildSettingsSchema";
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
    ...ReadGuildSettingValues(row, logger),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}
