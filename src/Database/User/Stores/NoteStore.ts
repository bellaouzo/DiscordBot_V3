import Database from "better-sqlite3";
import { MapNote } from "@database/User/Mappers";
import { Note } from "@database/User/Types";

export class NoteStore {
  constructor(private readonly db: Database.Database) {}

  AddNote(data: {
    user_id: string;
    guild_id: string;
    moderator_id: string;
    content: string;
  }): Note {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO notes (user_id, guild_id, moderator_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.user_id,
      data.guild_id,
      data.moderator_id,
      data.content,
      created_at,
    ).lastInsertRowid as number;

    const note = this.GetNoteById(id, data.guild_id);
    if (!note) {
      throw new Error("Failed to create note");
    }

    return note;
  }

  GetNotes(user_id: string, guild_id: string, limit?: number): Note[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notes
      WHERE user_id = ? AND guild_id = ?
      ORDER BY created_at ASC
      ${limit ? "LIMIT ?" : ""}
    `);

    const rows = limit
      ? (stmt.all(user_id, guild_id, limit) as Record<string, unknown>[])
      : (stmt.all(user_id, guild_id) as Record<string, unknown>[]);

    return rows.map((row) => MapNote(row));
  }

  GetNoteById(id: number, guild_id: string): Note | null {
    const stmt = this.db.prepare(
      "SELECT * FROM notes WHERE id = ? AND guild_id = ?",
    );
    const row = stmt.get(id, guild_id) as Record<string, unknown> | undefined;
    return row ? MapNote(row) : null;
  }

  RemoveNoteById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM notes WHERE id = ? AND guild_id = ?",
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestNote(user_id: string, guild_id: string): Note | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM notes
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      )
      .get(user_id, guild_id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const note = MapNote(row);
    const removed = this.RemoveNoteById(note.id, guild_id);
    return removed ? note : null;
  }
}
