import type Database from "better-sqlite3";
import { MapTicketMessage } from "@database/Ticket/Mappers";
import type { TicketMessage } from "@database/Ticket/Types";

export class TicketMessageStore {
  constructor(private readonly db: Database.Database) {}

  AddMessage(
    ticket_id: number,
    user_id: string,
    content: string,
  ): TicketMessage {
    const timestamp = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO ticket_messages (ticket_id, user_id, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    const id = stmt.run(ticket_id, user_id, content, timestamp)
      .lastInsertRowid as number;

    return {
      id,
      ticket_id,
      user_id,
      content,
      timestamp,
    };
  }

  GetTicketMessages(ticket_id: number): TicketMessage[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketMessage(row));
  }
}
