import type Database from "better-sqlite3";
import type {
  BlocklistEntry,
  BlocklistTargetType,
} from "@database/Server/Types";

function MapBlocklistEntry(row: Record<string, unknown>): BlocklistEntry {
  return {
    target_type: row.target_type as BlocklistTargetType,
    target_id: String(row.target_id),
    reason: row.reason === null ? null : String(row.reason),
    created_by: String(row.created_by),
    created_at: Number(row.created_at),
  };
}

/** Global (not per-guild) list of users and guilds the bot refuses to serve. */
export class BlocklistStore {
  constructor(private readonly db: Database.Database) {}

  GetBlocklistEntry(
    target_type: BlocklistTargetType,
    target_id: string,
  ): BlocklistEntry | null {
    const row = this.db
      .prepare(
        "SELECT * FROM bot_blocklist WHERE target_type = ? AND target_id = ?",
      )
      .get(target_type, target_id) as Record<string, unknown> | undefined;
    return row ? MapBlocklistEntry(row) : null;
  }

  /** Adds an entry, or replaces the reason of an existing one. */
  AddToBlocklist(data: {
    target_type: BlocklistTargetType;
    target_id: string;
    reason: string | null;
    created_by: string;
  }): BlocklistEntry {
    const now = Date.now();
    this.db
      .prepare(
        `
        INSERT INTO bot_blocklist (target_type, target_id, reason, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(target_type, target_id) DO UPDATE SET
          reason = excluded.reason,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `,
      )
      .run(data.target_type, data.target_id, data.reason, data.created_by, now);

    return { ...data, created_at: now };
  }

  RemoveFromBlocklist(
    target_type: BlocklistTargetType,
    target_id: string,
  ): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM bot_blocklist WHERE target_type = ? AND target_id = ?",
      )
      .run(target_type, target_id);
    return result.changes > 0;
  }

  ListBlocklist(): BlocklistEntry[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM bot_blocklist ORDER BY target_type ASC, created_at DESC",
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map(MapBlocklistEntry);
  }
}
