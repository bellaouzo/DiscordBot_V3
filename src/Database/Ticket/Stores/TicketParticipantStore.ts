import Database from "better-sqlite3";
import { MapTicketParticipant } from "@database/Ticket/Mappers";
import { TicketParticipant } from "@database/Ticket/Types";

export class TicketParticipantStore {
  constructor(private readonly db: Database.Database) {}

  AddParticipant(
    ticket_id: number,
    user_id: string,
    added_by: string,
  ): TicketParticipant {
    const added_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO ticket_participants (ticket_id, user_id, added_by, added_at)
      VALUES (?, ?, ?, ?)
    `);

    const id = stmt.run(ticket_id, user_id, added_by, added_at)
      .lastInsertRowid as number;

    return {
      id,
      ticket_id,
      user_id,
      added_by,
      added_at,
    };
  }

  GetParticipants(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? ORDER BY added_at ASC",
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketParticipant(row));
  }

  GetActiveParticipants(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? AND removed_by IS NULL ORDER BY added_at ASC",
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketParticipant(row));
  }

  GetParticipantHistory(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? ORDER BY added_at ASC",
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketParticipant(row));
  }

  RemoveParticipant(
    ticket_id: number,
    user_id: string,
    removed_by: string,
  ): boolean {
    const removed_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE ticket_participants SET removed_by = ?, removed_at = ? WHERE ticket_id = ? AND user_id = ? AND removed_by IS NULL",
    );
    const result = stmt.run(removed_by, removed_at, ticket_id, user_id);
    return result.changes > 0;
  }
}
