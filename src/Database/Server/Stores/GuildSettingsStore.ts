import type Database from "better-sqlite3";
import type { Logger } from "@shared/Logger";
import { MapGuildSettings } from "@database/Server/Mappers";
import type { GuildSettings, GuildSettingsRow } from "@database/Server/Types";
import type { GuildSettingsUpdate } from "@database/Server/GuildSettingsSchema";
import {
  GUILD_SETTING_KEYS,
  MergeGuildSettingValues,
  ToGuildSettingRowValues,
} from "@database/Server/GuildSettingsSchema";

const COLUMNS = ["guild_id", ...GUILD_SETTING_KEYS, "created_at", "updated_at"];

const SELECT_SQL = `SELECT ${COLUMNS.join(", ")} FROM guild_settings WHERE guild_id = ?`;

const UPSERT_SQL = `
  INSERT INTO guild_settings (${COLUMNS.join(", ")})
  VALUES (${COLUMNS.map(() => "?").join(", ")})
  ON CONFLICT(guild_id) DO UPDATE SET
    ${[...GUILD_SETTING_KEYS, "updated_at"].map((column) => `${column} = excluded.${column}`).join(", ")}
`;

export class GuildSettingsStore {
  constructor(
    private readonly db: Database.Database,
    private readonly logger: Logger,
  ) {}

  GetGuildSettings(guild_id: string): GuildSettings | null {
    const row = this.db.prepare(SELECT_SQL).get(guild_id) as
      | GuildSettingsRow
      | undefined;

    return row ? MapGuildSettings(row, this.logger) : null;
  }

  UpsertGuildSettings(settings: GuildSettingsUpdate): GuildSettings {
    const existing = this.GetGuildSettings(settings.guild_id);
    const now = Date.now();
    const values = MergeGuildSettingValues(settings, existing);

    this.db
      .prepare(UPSERT_SQL)
      .run(
        settings.guild_id,
        ...ToGuildSettingRowValues(values),
        existing?.created_at ?? now,
        now,
      );

    const saved = this.GetGuildSettings(settings.guild_id);
    if (!saved) {
      throw new Error("Failed to save guild settings");
    }

    return saved;
  }
}
