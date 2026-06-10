import Database from "better-sqlite3";

export class TicketTagStore {
  constructor(private readonly db: Database.Database) {}

  AddTicketTag(ticket_id: number, tag: string): boolean {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO ticket_tags (ticket_id, tag, created_at)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(ticket_id, normalized, created_at);
    return result.changes > 0;
  }

  RemoveTicketTag(ticket_id: number, tag: string): boolean {
    const normalized = tag.trim().toLowerCase();
    const stmt = this.db.prepare(
      "DELETE FROM ticket_tags WHERE ticket_id = ? AND tag = ?",
    );
    const result = stmt.run(ticket_id, normalized);
    return result.changes > 0;
  }

  ListTicketTags(ticket_id: number): string[] {
    const stmt = this.db.prepare(
      "SELECT tag FROM ticket_tags WHERE ticket_id = ? ORDER BY tag ASC",
    );
    const rows = stmt.all(ticket_id) as Array<{ tag: string }>;
    return rows.map((row) => row.tag);
  }

  GetTagsForTickets(ticketIds: number[]): Record<number, string[]> {
    if (ticketIds.length === 0) {
      return {};
    }

    const placeholders = ticketIds.map(() => "?").join(", ");
    const stmt = this.db.prepare(
      `SELECT ticket_id, tag FROM ticket_tags WHERE ticket_id IN (${placeholders}) ORDER BY tag ASC`,
    );
    const rows = stmt.all(...ticketIds) as Array<{
      ticket_id: number;
      tag: string;
    }>;

    const map: Record<number, string[]> = {};
    for (const row of rows) {
      if (!map[row.ticket_id]) {
        map[row.ticket_id] = [];
      }
      map[row.ticket_id].push(row.tag);
    }
    return map;
  }
}
