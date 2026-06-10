import Database from "better-sqlite3";
import { MapTicketReopenAudit } from "@database/Ticket/Mappers";
import { TicketReopenAudit } from "@database/Ticket/Types";

export class TicketReopenAuditStore {
  constructor(private readonly db: Database.Database) {}

  AddReopenAudit(data: {
    prior_ticket_id: number;
    new_ticket_id: number;
    guild_id: string;
    reopened_by: string;
    reason?: string | null;
    prior_status?: string | null;
    transcript_url?: string | null;
  }): TicketReopenAudit {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO ticket_reopen_audits (prior_ticket_id, new_ticket_id, guild_id, reopened_by, reason, prior_status, transcript_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.prior_ticket_id,
      data.new_ticket_id,
      data.guild_id,
      data.reopened_by,
      data.reason ?? null,
      data.prior_status ?? null,
      data.transcript_url ?? null,
      created_at,
    ).lastInsertRowid as number;

    return {
      id,
      created_at,
      prior_ticket_id: data.prior_ticket_id,
      new_ticket_id: data.new_ticket_id,
      guild_id: data.guild_id,
      reopened_by: data.reopened_by,
      reason: data.reason ?? null,
      prior_status: data.prior_status ?? null,
      transcript_url: data.transcript_url ?? null,
    };
  }

  GetReopenAuditsForTicket(ticket_id: number): TicketReopenAudit[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_reopen_audits WHERE prior_ticket_id = ? ORDER BY created_at DESC",
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicketReopenAudit(row));
  }
}
