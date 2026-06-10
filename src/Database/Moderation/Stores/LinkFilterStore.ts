import type Database from "better-sqlite3";
import { MapLinkFilter } from "@database/Moderation/Mappers";
import type { LinkFilter, LinkFilterType } from "@database/Moderation/Types";

export class LinkFilterStore {
  constructor(private readonly db: Database.Database) {}

  AddLinkFilter(data: {
    guild_id: string;
    pattern: string;
    type: LinkFilterType;
    created_by: string;
  }): LinkFilter {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO link_filters (guild_id, pattern, type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const normalizedPattern = data.pattern.trim().toLowerCase();
    const id = stmt.run(
      data.guild_id,
      normalizedPattern,
      data.type,
      data.created_by,
      created_at,
    ).lastInsertRowid as number;

    const record = this.GetLinkFilterById(id);
    if (!record) {
      throw new Error("Failed to create link filter");
    }

    return record;
  }

  GetLinkFilterById(id: number): LinkFilter | null {
    const stmt = this.db.prepare("SELECT * FROM link_filters WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapLinkFilter(row) : null;
  }

  ListLinkFilters(guild_id: string): LinkFilter[] {
    const stmt = this.db.prepare(
      "SELECT * FROM link_filters WHERE guild_id = ? ORDER BY created_at DESC",
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapLinkFilter(row));
  }

  RemoveLinkFilter(data: {
    guild_id: string;
    pattern: string;
    type: LinkFilterType;
  }): boolean {
    const normalizedPattern = data.pattern.trim().toLowerCase();
    const stmt = this.db.prepare(
      "DELETE FROM link_filters WHERE guild_id = ? AND pattern = ? AND type = ?",
    );
    const result = stmt.run(data.guild_id, normalizedPattern, data.type);
    return result.changes > 0;
  }
}
