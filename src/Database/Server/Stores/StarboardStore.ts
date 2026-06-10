import type Database from "better-sqlite3";
import type { StarboardEntry } from "@database/Server/Types";

type StarboardRow = {
  id: number;
  guild_id: string;
  source_channel_id: string;
  source_message_id: string;
  starboard_message_id: string;
  star_count: number;
  created_at: number;
};

function MapEntry(row: StarboardRow): StarboardEntry {
  return {
    id: row.id,
    guild_id: row.guild_id,
    source_channel_id: row.source_channel_id,
    source_message_id: row.source_message_id,
    starboard_message_id: row.starboard_message_id,
    star_count: row.star_count,
    created_at: row.created_at,
  };
}

export class StarboardStore {
  constructor(private readonly db: Database.Database) {}

  GetEntry(
    guild_id: string,
    source_message_id: string,
  ): StarboardEntry | null {
    const row = this.db
      .prepare(
        "SELECT * FROM starboard_entries WHERE guild_id = ? AND source_message_id = ?",
      )
      .get(guild_id, source_message_id) as StarboardRow | undefined;

    return row ? MapEntry(row) : null;
  }

  CreateEntry(data: {
    guild_id: string;
    source_channel_id: string;
    source_message_id: string;
    starboard_message_id: string;
    star_count: number;
  }): StarboardEntry {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO starboard_entries (
        guild_id,
        source_channel_id,
        source_message_id,
        starboard_message_id,
        star_count,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const id = stmt.run(
      data.guild_id,
      data.source_channel_id,
      data.source_message_id,
      data.starboard_message_id,
      data.star_count,
      created_at,
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM starboard_entries WHERE id = ?")
      .get(id) as StarboardRow;

    return MapEntry(row);
  }

  UpdateStarCount(
    guild_id: string,
    source_message_id: string,
    star_count: number,
  ): boolean {
    const result = this.db
      .prepare(
        "UPDATE starboard_entries SET star_count = ? WHERE guild_id = ? AND source_message_id = ?",
      )
      .run(star_count, guild_id, source_message_id);

    return result.changes > 0;
  }

  DeleteEntry(guild_id: string, source_message_id: string): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM starboard_entries WHERE guild_id = ? AND source_message_id = ?",
      )
      .run(guild_id, source_message_id);

    return result.changes > 0;
  }
}
