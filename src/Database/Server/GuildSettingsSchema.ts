import type { Logger } from "@shared/Logger";
import { NormalizeIds, ParseIdList } from "@database/Server/Mappers";

/**
 * Single source of truth for the `guild_settings` table. Types, the row mapper, the
 * SELECT/UPSERT SQL and the dashboard save route are all derived from these specs.
 *
 * To add a setting:
 *   1. Add a field here.
 *   2. Add a migration that creates its column (see `GuildSettingColumns`).
 * `tests/database/GuildSettingsSchema.test.ts` fails if step 2 is forgotten.
 */
export interface SettingSpec<T> {
  readonly sqlType: "TEXT" | "INTEGER";
  /** Value used when the column is NULL or the guild has no row yet. */
  readonly defaultValue: T;
  /**
   * When true, an explicit `null` in an update clears the stored value. When false,
   * `null` is treated like "not provided" and the existing value is kept.
   */
  readonly clearable: boolean;
  /** Whether the dashboard settings form may write this field. */
  readonly editable: boolean;
  fromRow(raw: unknown, logger?: Logger): T;
  toRow(value: T): string | number | null;
  /** Parses a raw dashboard form value. `undefined`/`null` mean "keep existing" unless clearable. */
  parseInput(raw: unknown): T | null | undefined;
}

interface SpecOptions {
  readonly clearable?: boolean;
  readonly editable?: boolean;
}

function ParseIntInput(raw: unknown, fallback: number | null): number | null {
  if (typeof raw === "number") {
    return raw;
  }
  return raw ? parseInt(String(raw)) : fallback;
}

export const Setting = {
  /** A Discord channel/role/user snowflake, or null. */
  id(options: SpecOptions = {}): SettingSpec<string | null> {
    return {
      sqlType: "TEXT",
      defaultValue: null,
      clearable: options.clearable ?? false,
      editable: options.editable ?? true,
      fromRow: (raw) => (raw ? String(raw) : null),
      toRow: (value) => value,
      parseInput: (raw) => (raw ? String(raw) : null),
    };
  },

  /** A list of snowflakes, stored as a JSON array. */
  idList(options: SpecOptions = {}): SettingSpec<string[]> {
    return {
      sqlType: "TEXT",
      defaultValue: [],
      clearable: false,
      editable: options.editable ?? true,
      fromRow: (raw, logger) =>
        ParseIdList(raw as string | null | undefined, logger),
      toRow: (value) => JSON.stringify(NormalizeIds(value)),
      parseInput: (raw) => {
        if (Array.isArray(raw)) return raw.map(String);
        if (typeof raw === "string") {
          return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      },
    };
  },

  text(defaultValue: string, options: SpecOptions = {}): SettingSpec<string> {
    return {
      sqlType: "TEXT",
      defaultValue,
      clearable: false,
      editable: options.editable ?? true,
      fromRow: (raw) => (raw ? String(raw) : defaultValue),
      toRow: (value) => value,
      parseInput: (raw) => (raw ? String(raw) : null),
    };
  },

  /**
   * @param inputFallback - Value saved when the dashboard sends an empty field; null keeps the existing value.
   */
  int(
    defaultValue: number,
    options: SpecOptions & { inputFallback?: number | null } = {},
  ): SettingSpec<number> {
    return {
      sqlType: "INTEGER",
      defaultValue,
      clearable: false,
      editable: options.editable ?? true,
      fromRow: (raw) =>
        raw !== null && raw !== undefined ? Number(raw) : defaultValue,
      toRow: (value) => value,
      parseInput: (raw) => ParseIntInput(raw, options.inputFallback ?? null),
    };
  },

  /** An optional number (e.g. a timestamp), or null. */
  optionalInt(options: SpecOptions = {}): SettingSpec<number | null> {
    return {
      sqlType: "INTEGER",
      defaultValue: null,
      clearable: options.clearable ?? false,
      editable: options.editable ?? true,
      fromRow: (raw) =>
        raw !== null && raw !== undefined ? Number(raw) : null,
      toRow: (value) => value,
      parseInput: (raw) => ParseIntInput(raw, null),
    };
  },

  bool(defaultValue: boolean, options: SpecOptions = {}): SettingSpec<boolean> {
    return {
      sqlType: "INTEGER",
      defaultValue,
      clearable: false,
      editable: options.editable ?? true,
      fromRow: (raw) =>
        raw !== null && raw !== undefined ? Boolean(raw) : defaultValue,
      toRow: (value) => (value ? 1 : 0),
      parseInput: (raw) => Boolean(raw),
    };
  },
};

export const GUILD_SETTING_FIELDS = {
  admin_role_ids: Setting.idList(),
  mod_role_ids: Setting.idList(),
  ticket_category_id: Setting.id(),
  appeal_review_category_id: Setting.id(),
  command_log_channel_id: Setting.id(),
  ticket_log_channel_id: Setting.id(),
  announcement_channel_id: Setting.id(),
  delete_log_channel_id: Setting.id(),
  production_log_channel_id: Setting.id(),
  welcome_channel_id: Setting.id(),
  autorole_id: Setting.id({ clearable: true }),
  starboard_channel_id: Setting.id({ clearable: true }),
  starboard_emoji: Setting.text("⭐"),
  starboard_threshold: Setting.int(3),
  roblox_linked_discord_user_id: Setting.id({ editable: false }),
  roblox_linked_at: Setting.optionalInt({ editable: false }),
  verification_enabled: Setting.bool(false),
  unverified_role_id: Setting.id({ clearable: true }),
  verified_role_id: Setting.id({ clearable: true }),
  verification_min_account_age_days: Setting.int(0, { inputFallback: 0 }),
  verification_channel_id: Setting.id({ clearable: true }),
  economy_enabled: Setting.bool(true),
  giveaways_enabled: Setting.bool(true),
  spam_filter_enabled: Setting.bool(false),
  tag_prefix: Setting.text("!"),
} as const;

type Fields = typeof GUILD_SETTING_FIELDS;
export type GuildSettingKey = keyof Fields;
type SettingValue<K extends GuildSettingKey> =
  Fields[K] extends SettingSpec<infer T> ? T : never;

export type GuildSettingValues = { [K in GuildSettingKey]: SettingValue<K> };

/** Keys of boolean settings, e.g. for feature toggles. */
export type GuildBooleanSettingKey = {
  [K in GuildSettingKey]: SettingValue<K> extends boolean ? K : never;
}[GuildSettingKey];

/**
 * A partial update. Omitted fields keep their stored value; see {@link SettingSpec.clearable}
 * for how `null` is treated.
 */
export type GuildSettingsUpdate = { guild_id: string } & {
  [K in GuildSettingKey]?: SettingValue<K> | null;
};

export const GUILD_SETTING_KEYS = Object.keys(
  GUILD_SETTING_FIELDS,
) as GuildSettingKey[];

function Spec<K extends GuildSettingKey>(key: K): SettingSpec<SettingValue<K>> {
  return GUILD_SETTING_FIELDS[key] as unknown as SettingSpec<SettingValue<K>>;
}

export function DefaultGuildSettingValues(): GuildSettingValues {
  const values = {} as Record<GuildSettingKey, unknown>;
  for (const key of GUILD_SETTING_KEYS) {
    values[key] = Spec(key).defaultValue;
  }
  return values as GuildSettingValues;
}

export function ReadGuildSettingValues(
  row: Record<string, unknown>,
  logger?: Logger,
): GuildSettingValues {
  const values = {} as Record<GuildSettingKey, unknown>;
  for (const key of GUILD_SETTING_KEYS) {
    values[key] = Spec(key).fromRow(row[key], logger);
  }
  return values as GuildSettingValues;
}

/**
 * Applies an update on top of the existing values (or defaults), field by field.
 */
export function MergeGuildSettingValues(
  update: GuildSettingsUpdate,
  existing: GuildSettingValues | null,
): GuildSettingValues {
  const merged = {} as Record<GuildSettingKey, unknown>;
  for (const key of GUILD_SETTING_KEYS) {
    const spec = Spec(key);
    const incoming = update[key];
    const fallback = existing ? existing[key] : spec.defaultValue;
    if (spec.clearable) {
      merged[key] = incoming !== undefined ? incoming : fallback;
    } else {
      merged[key] = incoming ?? fallback;
    }
  }
  return merged as GuildSettingValues;
}

export function ToGuildSettingRowValues(
  values: GuildSettingValues,
): Array<string | number | null> {
  return GUILD_SETTING_KEYS.map((key) => Spec(key).toRow(values[key]));
}

/**
 * Builds an update from a dashboard form body, using only editable fields.
 */
export function ParseGuildSettingsInput(
  guildId: string,
  body: Record<string, unknown>,
): GuildSettingsUpdate {
  const update: Record<string, unknown> = { guild_id: guildId };
  for (const key of GUILD_SETTING_KEYS) {
    const spec = Spec(key);
    if (spec.editable) {
      update[key] = spec.parseInput(body[key]);
    }
  }
  return update as GuildSettingsUpdate;
}

/**
 * Column definitions for a migration that adds new settings, e.g.
 * `AddTableColumnsIfMissing(db, "guild_settings", GuildSettingColumns(["new_key"]))`.
 */
export function GuildSettingColumns(
  keys: readonly GuildSettingKey[],
): ReadonlyArray<readonly [string, string]> {
  return keys.map((key) => [key, GUILD_SETTING_FIELDS[key].sqlType] as const);
}
