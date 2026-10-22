import type Database from "better-sqlite3";
import type { CustomTag } from "@database/Server/Types";

function MapCustomTag(row: Record<string, unknown>): CustomTag {
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    name: String(row.name),
    content: String(row.content),
    created_by: String(row.created_by),
    uses: Number(row.uses),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

/** Tag names are stored lowercase, so lookups are case-insensitive. */
function NormalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export class CustomTagStore {
  constructor(private readonly db: Database.Database) {}

  CreateCustomTag(data: {
    guild_id: string;
    name: string;
    content: string;
    created_by: string;
  }): CustomTag {
    const now = Date.now();
    const name = NormalizeTagName(data.name);
    this.db
      .prepare(
        `
        INSERT INTO custom_tags (guild_id, name, content, created_by, uses, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `,
      )
      .run(data.guild_id, name, data.content, data.created_by, now, now);

    const created = this.GetCustomTag(data.guild_id, name);
    if (!created) {
      throw new Error("Failed to create custom tag");
    }
    return created;
  }

  GetCustomTag(guild_id: string, name: string): CustomTag | null {
    const row = this.db
      .prepare("SELECT * FROM custom_tags WHERE guild_id = ? AND name = ?")
      .get(guild_id, NormalizeTagName(name)) as
      | Record<string, unknown>
      | undefined;
    return row ? MapCustomTag(row) : null;
  }

  ListCustomTags(guild_id: string): CustomTag[] {
    const rows = this.db
      .prepare("SELECT * FROM custom_tags WHERE guild_id = ? ORDER BY name ASC")
      .all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapCustomTag(row));
  }

  CountCustomTags(guild_id: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM custom_tags WHERE guild_id = ?")
      .get(guild_id) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /** Names containing `query`, prefix matches first. Used for autocomplete. */
  SearchCustomTagNames(guild_id: string, query: string, limit = 25): string[] {
    const normalized = NormalizeTagName(query);
    const escaped = normalized.replace(/[\\%_]/g, (char) => `\\${char}`);
    const rows = this.db
      .prepare(
        `
        SELECT name FROM custom_tags
        WHERE guild_id = ? AND name LIKE ? ESCAPE '\\'
        ORDER BY (name LIKE ? ESCAPE '\\') DESC, uses DESC, name ASC
        LIMIT ?
      `,
      )
      .all(guild_id, `%${escaped}%`, `${escaped}%`, limit) as Array<{
      name: string;
    }>;
    return rows.map((row) => row.name);
  }

  UpdateCustomTagContent(data: {
    guild_id: string;
    name: string;
    content: string;
  }): boolean {
    const result = this.db
      .prepare(
        "UPDATE custom_tags SET content = ?, updated_at = ? WHERE guild_id = ? AND name = ?",
      )
      .run(
        data.content,
        Date.now(),
        data.guild_id,
        NormalizeTagName(data.name),
      );
    return result.changes > 0;
  }

  DeleteCustomTag(guild_id: string, name: string): boolean {
    const result = this.db
      .prepare("DELETE FROM custom_tags WHERE guild_id = ? AND name = ?")
      .run(guild_id, NormalizeTagName(name));
    return result.changes > 0;
  }

  IncrementCustomTagUses(guild_id: string, name: string): void {
    this.db
      .prepare(
        "UPDATE custom_tags SET uses = uses + 1 WHERE guild_id = ? AND name = ?",
      )
      .run(guild_id, NormalizeTagName(name));
  }
}
