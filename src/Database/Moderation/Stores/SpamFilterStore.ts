import type Database from "better-sqlite3";
import { ParseIdList } from "@database/Server/Mappers";
import type {
  SpamFilterSettings,
  SpamStrike,
  SpamStrikeAction,
} from "@database/Moderation/Types";
import {
  IsSpamStrikeAction,
  SPAM_FILTER_DEFAULTS,
} from "@database/Moderation/Types";

function MapSpamFilterSettings(
  row: Record<string, unknown>,
): SpamFilterSettings {
  return {
    guild_id: String(row.guild_id),
    max_messages: Number(row.max_messages),
    window_seconds: Number(row.window_seconds),
    duplicate_threshold: Number(row.duplicate_threshold),
    mention_threshold: Number(row.mention_threshold),
    strike_decay_hours: Number(row.strike_decay_hours),
    exempt_channel_ids: ParseIdList(row.exempt_channel_ids as string | null),
  };
}

function MapSpamStrike(row: Record<string, unknown>): SpamStrike {
  const action = row.action;
  if (!IsSpamStrikeAction(action)) {
    throw new Error(`Invalid spam strike action: ${action}`);
  }
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    user_id: String(row.user_id),
    reason: String(row.reason),
    action,
    duration_ms:
      row.duration_ms === null || row.duration_ms === undefined
        ? null
        : Number(row.duration_ms),
    created_at: Number(row.created_at),
  };
}

export class SpamFilterStore {
  constructor(private readonly db: Database.Database) {}

  GetSpamFilterSettings(guild_id: string): SpamFilterSettings {
    const row = this.db
      .prepare("SELECT * FROM spam_filter_settings WHERE guild_id = ?")
      .get(guild_id) as Record<string, unknown> | undefined;
    return row
      ? MapSpamFilterSettings(row)
      : { guild_id, ...SPAM_FILTER_DEFAULTS, exempt_channel_ids: [] };
  }

  UpsertSpamFilterSettings(
    settings: Partial<Omit<SpamFilterSettings, "guild_id">> & {
      guild_id: string;
    },
  ): SpamFilterSettings {
    const existing = this.GetSpamFilterSettings(settings.guild_id);
    const merged: SpamFilterSettings = {
      guild_id: settings.guild_id,
      max_messages: settings.max_messages ?? existing.max_messages,
      window_seconds: settings.window_seconds ?? existing.window_seconds,
      duplicate_threshold:
        settings.duplicate_threshold ?? existing.duplicate_threshold,
      mention_threshold:
        settings.mention_threshold ?? existing.mention_threshold,
      strike_decay_hours:
        settings.strike_decay_hours ?? existing.strike_decay_hours,
      exempt_channel_ids:
        settings.exempt_channel_ids ?? existing.exempt_channel_ids,
    };

    this.db
      .prepare(
        `
        INSERT INTO spam_filter_settings (
          guild_id, max_messages, window_seconds, duplicate_threshold,
          mention_threshold, strike_decay_hours, exempt_channel_ids, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          max_messages = excluded.max_messages,
          window_seconds = excluded.window_seconds,
          duplicate_threshold = excluded.duplicate_threshold,
          mention_threshold = excluded.mention_threshold,
          strike_decay_hours = excluded.strike_decay_hours,
          exempt_channel_ids = excluded.exempt_channel_ids,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        merged.guild_id,
        merged.max_messages,
        merged.window_seconds,
        merged.duplicate_threshold,
        merged.mention_threshold,
        merged.strike_decay_hours,
        JSON.stringify(merged.exempt_channel_ids),
        Date.now(),
      );

    return merged;
  }

  AddSpamStrike(data: {
    guild_id: string;
    user_id: string;
    reason: string;
    action: SpamStrikeAction;
    duration_ms?: number | null;
  }): void {
    this.db
      .prepare(
        `
        INSERT INTO spam_strikes (guild_id, user_id, reason, action, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        data.guild_id,
        data.user_id,
        data.reason,
        data.action,
        data.duration_ms ?? null,
        Date.now(),
      );
  }

  CountSpamStrikesSince(data: {
    guild_id: string;
    user_id: string;
    since: number;
  }): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM spam_strikes WHERE guild_id = ? AND user_id = ? AND created_at >= ?",
      )
      .get(data.guild_id, data.user_id, data.since) as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }

  ListSpamStrikes(guild_id: string, user_id: string, limit = 10): SpamStrike[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM spam_strikes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .all(guild_id, user_id, limit) as Record<string, unknown>[];
    return rows.map((row) => MapSpamStrike(row));
  }

  ClearSpamStrikes(guild_id: string, user_id: string): number {
    return this.db
      .prepare("DELETE FROM spam_strikes WHERE guild_id = ? AND user_id = ?")
      .run(guild_id, user_id).changes;
  }
}
