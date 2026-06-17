import type Database from "better-sqlite3";
import { MapTicket } from "@database/Ticket/Mappers";
import type { Ticket } from "@database/Ticket/Types";

export class TicketStore {
  constructor(private readonly db: Database.Database) {}

  CreateTicket(data: {
    user_id: string;
    guild_id: string;
    channel_id: string | null;
    category: string;
  }): Ticket {
    const stmt = this.db.prepare(`
      INSERT INTO tickets (user_id, guild_id, channel_id, category, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const created_at = Date.now();
    const id = stmt.run(
      data.user_id,
      data.guild_id,
      data.channel_id,
      data.category,
      created_at,
    ).lastInsertRowid as number;

    const ticket = this.GetTicket(id);
    if (!ticket) {
      throw new Error("Failed to retrieve created ticket");
    }

    return ticket;
  }

  GetTicket(id: number): Ticket | null {
    const stmt = this.db.prepare("SELECT * FROM tickets WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapTicket(row) : null;
  }

  GetTicketByChannel(channel_id: string): Ticket | null {
    const stmt = this.db.prepare("SELECT * FROM tickets WHERE channel_id = ?");
    const row = stmt.get(channel_id) as Record<string, unknown> | undefined;
    return row ? MapTicket(row) : null;
  }

  GetUserTickets(user_id: string, guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ?",
    );
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = ?",
      );
      const rows = stmt.all(user_id, guild_id, status) as Record<
        string,
        unknown
      >[];
      return rows.map((row) => MapTicket(row));
    }
    const rows = stmt.all(user_id, guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicket(row));
  }

  GetActiveUserTickets(user_id: string, guild_id: string): Ticket[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status IN ('open', 'claimed') ORDER BY created_at DESC",
    );
    const rows = stmt.all(user_id, guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicket(row));
  }

  GetGuildTickets(guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare("SELECT * FROM tickets WHERE guild_id = ?");
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE guild_id = ? AND status = ?",
      );
      const rows = stmt.all(guild_id, status) as Record<string, unknown>[];
      return rows.map((row) => MapTicket(row));
    }
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicket(row));
  }

  GetActiveGuildTickets(guild_id: string): Ticket[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE guild_id = ? AND status IN ('open', 'claimed') ORDER BY created_at ASC",
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapTicket(row));
  }

  UpdateTicketStatus(
    id: number,
    status: string,
    claimed_by?: string | null,
  ): boolean {
    const stmt = this.db.prepare(
      "UPDATE tickets SET status = ?, claimed_by = ? WHERE id = ?",
    );
    const result = stmt.run(status, claimed_by ?? null, id);
    return result.changes > 0;
  }

  UpdateTicketChannelId(id: number, channel_id: string): boolean {
    const stmt = this.db.prepare(
      "UPDATE tickets SET channel_id = ? WHERE id = ?",
    );
    const result = stmt.run(channel_id, id);
    return result.changes > 0;
  }

  CloseTicket(
    id: number,
    claimed_by?: string | null,
    close_reason?: string | null,
  ): boolean {
    const closed_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE tickets SET status = ?, claimed_by = ?, closed_at = ?, close_reason = ? WHERE id = ?",
    );
    const result = stmt.run(
      "closed",
      claimed_by ?? null,
      closed_at,
      close_reason ?? null,
      id,
    );
    return result.changes > 0;
  }

  DeleteTicket(id: number): boolean {
    const stmt = this.db.prepare("DELETE FROM tickets WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
