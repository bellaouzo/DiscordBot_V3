import type Database from "better-sqlite3";
import { ParseIdList } from "@database/Server/Mappers";
import type {
  GuildXpSettings,
  GuildXpSettingsRow,
} from "@database/Server/Types";
import {
  CHAT_XP_DEFAULT_COOLDOWN_SECONDS,
  CHAT_XP_DEFAULT_DAILY_CAP,
  CHAT_XP_DEFAULT_MIN_MESSAGE_LENGTH,
  CHAT_XP_DEFAULT_PER_MESSAGE,
} from "@systems/Leveling/constants";

function MapGuildXpSettings(row: GuildXpSettingsRow): GuildXpSettings {
  return {
    guild_id: String(row.guild_id),
    enabled: Boolean(row.enabled),
    xp_per_message: Number(row.xp_per_message),
    cooldown_seconds: Number(row.cooldown_seconds),
    min_message_length: Number(row.min_message_length),
    daily_cap: Number(row.daily_cap),
    excluded_channel_ids: ParseIdList(row.excluded_channel_ids),
    level_up_channel_id: row.level_up_channel_id
      ? String(row.level_up_channel_id)
      : null,
  };
}

function DefaultSettings(guild_id: string): GuildXpSettings {
  return {
    guild_id,
    enabled: false,
    xp_per_message: CHAT_XP_DEFAULT_PER_MESSAGE,
    cooldown_seconds: CHAT_XP_DEFAULT_COOLDOWN_SECONDS,
    min_message_length: CHAT_XP_DEFAULT_MIN_MESSAGE_LENGTH,
    daily_cap: CHAT_XP_DEFAULT_DAILY_CAP,
    excluded_channel_ids: [],
    level_up_channel_id: null,
  };
}

export class GuildXpSettingsStore {
  constructor(private readonly db: Database.Database) {}

  GetGuildXpSettings(guild_id: string): GuildXpSettings {
    const stmt = this.db.prepare(
      "SELECT * FROM guild_xp_settings WHERE guild_id = ?",
    );
    const row = stmt.get(guild_id) as GuildXpSettingsRow | undefined;

    if (!row) {
      return DefaultSettings(guild_id);
    }

    return MapGuildXpSettings(row);
  }

  UpsertGuildXpSettings(
    settings: Partial<Omit<GuildXpSettings, "guild_id">> & { guild_id: string },
  ): GuildXpSettings {
    const existing = this.GetGuildXpSettings(settings.guild_id);
    const merged: GuildXpSettings = {
      guild_id: settings.guild_id,
      enabled: settings.enabled ?? existing.enabled,
      xp_per_message: settings.xp_per_message ?? existing.xp_per_message,
      cooldown_seconds: settings.cooldown_seconds ?? existing.cooldown_seconds,
      min_message_length:
        settings.min_message_length ?? existing.min_message_length,
      daily_cap: settings.daily_cap ?? existing.daily_cap,
      excluded_channel_ids:
        settings.excluded_channel_ids ?? existing.excluded_channel_ids,
      level_up_channel_id:
        settings.level_up_channel_id !== undefined
          ? settings.level_up_channel_id
          : existing.level_up_channel_id,
    };

    const stmt = this.db.prepare(`
      INSERT INTO guild_xp_settings (
        guild_id,
        enabled,
        xp_per_message,
        cooldown_seconds,
        min_message_length,
        daily_cap,
        excluded_channel_ids,
        level_up_channel_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled = excluded.enabled,
        xp_per_message = excluded.xp_per_message,
        cooldown_seconds = excluded.cooldown_seconds,
        min_message_length = excluded.min_message_length,
        daily_cap = excluded.daily_cap,
        excluded_channel_ids = excluded.excluded_channel_ids,
        level_up_channel_id = excluded.level_up_channel_id
    `);

    stmt.run(
      merged.guild_id,
      merged.enabled ? 1 : 0,
      merged.xp_per_message,
      merged.cooldown_seconds,
      merged.min_message_length,
      merged.daily_cap,
      JSON.stringify(merged.excluded_channel_ids),
      merged.level_up_channel_id,
    );

    return merged;
  }
}
