import Database from "better-sqlite3";
import { MapRaidMode, MapRaidModeChannel } from "@database/Moderation/Mappers";
import { RaidMode, RaidModeChannelState } from "@database/Moderation/Types";

export class RaidModeStore {
  constructor(private readonly db: Database.Database) {}

  AddRaidMode(data: {
    guild_id: string;
    slowmode_seconds: number;
    expires_at: number | null;
    applied_by: string;
  }): RaidMode {
    const applied_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO raid_modes (guild_id, slowmode_seconds, expires_at, applied_by, applied_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const id = stmt.run(
      data.guild_id,
      data.slowmode_seconds,
      data.expires_at,
      data.applied_by,
      applied_at,
    ).lastInsertRowid as number;

    const record = this.GetRaidModeById(id);
    if (!record) {
      throw new Error("Failed to create raid mode");
    }

    return record;
  }

  GetRaidModeById(id: number): RaidMode | null {
    const stmt = this.db.prepare("SELECT * FROM raid_modes WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapRaidMode(row) : null;
  }

  GetActiveRaidMode(guild_id: string): RaidMode | null {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE guild_id = ? AND active = 1",
    );
    const row = stmt.get(guild_id) as Record<string, unknown> | undefined;
    return row ? MapRaidMode(row) : null;
  }

  ListExpiredRaidModes(before: number): RaidMode[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_modes WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?",
    );
    const rows = stmt.all(before) as Record<string, unknown>[];
    return rows.map((row) => MapRaidMode(row));
  }

  MarkRaidModeCleared(id: number): boolean {
    const cleared_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE raid_modes SET active = 0, cleared_at = ? WHERE id = ?",
    );
    const result = stmt.run(cleared_at, id);
    return result.changes > 0;
  }

  AddRaidModeChannelState(data: {
    raid_id: number;
    guild_id: string;
    channel_id: string;
    overwrites: string;
    rate_limit_per_user: number;
  }): RaidModeChannelState {
    const stmt = this.db.prepare(`
      INSERT INTO raid_mode_channels (raid_id, guild_id, channel_id, overwrites, rate_limit_per_user)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.raid_id,
      data.guild_id,
      data.channel_id,
      data.overwrites,
      data.rate_limit_per_user,
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM raid_mode_channels WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Failed to create raid mode channel state");
    }
    return MapRaidModeChannel(row);
  }

  ListRaidModeChannelStates(raid_id: number): RaidModeChannelState[] {
    const stmt = this.db.prepare(
      "SELECT * FROM raid_mode_channels WHERE raid_id = ?",
    );
    const rows = stmt.all(raid_id) as Record<string, unknown>[];
    return rows.map((row) => MapRaidModeChannel(row));
  }

  ClearRaidModeChannelStates(raid_id: number): void {
    const stmt = this.db.prepare(
      "DELETE FROM raid_mode_channels WHERE raid_id = ?",
    );
    stmt.run(raid_id);
  }
}
