import Database from "better-sqlite3";
import * as fs from "fs";
import { Logger } from "@shared/Logger";
import { join } from "path";

export interface Ticket {
  id: number;
  user_id: string;
  guild_id: string;
  channel_id: string | null;
  category: string;
  status: "open" | "claimed" | "closed";
  claimed_by: string | null;
  created_at: number;
  closed_at: number | null;
}

export interface TicketReopenAudit {
  id: number;
  prior_ticket_id: number;
  new_ticket_id: number;
  guild_id: string;
  reopened_by: string;
  reason: string | null;
  prior_status: string | null;
  transcript_url: string | null;
  created_at: number;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: string;
  content: string;
  timestamp: number;
}

export interface TicketParticipant {
  id: number;
  ticket_id: number;
  user_id: string;
  added_by: string;
  added_at: number;
  removed_by?: string;
  removed_at?: number;
}

export interface TicketCategory {
  value: string;
  label: string;
  description: string;
  emoji: string;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  {
    value: "general",
    label: "General Support",
    description: "General questions and support",
    emoji: "💬",
  },
  {
    value: "technical",
    label: "Technical Issue",
    description: "Technical problems or bugs",
    emoji: "🔧",
  },
  {
    value: "report",
    label: "Report",
    description: "Report users or issues",
    emoji: "🚨",
  },
  {
    value: "other",
    label: "Other",
    description: "Other inquiries",
    emoji: "📝",
  },
];

export class TicketDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = join(process.cwd(), "data");
    const dbPath = join(dataDir, "tickets.db");

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        claimed_by TEXT,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ticket_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        removed_by TEXT,
        removed_at INTEGER,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket ON ticket_participants(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_participants_user ON ticket_participants(user_id);

      CREATE TABLE IF NOT EXISTS ticket_reopen_audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prior_ticket_id INTEGER NOT NULL,
        new_ticket_id INTEGER NOT NULL,
        guild_id TEXT NOT NULL,
        reopened_by TEXT NOT NULL,
        reason TEXT,
        prior_status TEXT,
        transcript_url TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_reopen_prior ON ticket_reopen_audits(prior_ticket_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_reopen_new ON ticket_reopen_audits(new_ticket_id);
    `);

    // Add migration for existing databases
    this.MigrateDatabase();
  }

  private MigrateDatabase(): void {
    try {
      // Check if removed_by column exists, if not add it
      const tableInfo = this.db
        .prepare<
          unknown[],
          { name: string }
        >("PRAGMA table_info(ticket_participants)")
        .all();
      const hasRemovedBy = tableInfo.some(
        (column) => column.name === "removed_by"
      );

      if (!hasRemovedBy) {
        this.db.exec(`
          ALTER TABLE ticket_participants ADD COLUMN removed_by TEXT;
          ALTER TABLE ticket_participants ADD COLUMN removed_at INTEGER;
        `);
      }
    } catch (error) {
      this.logger.Error("Failed to migrate database", { error });
    }
  }

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
      created_at
    ).lastInsertRowid as number;

    const ticket = this.GetTicket(id);
    if (!ticket) {
      throw new Error("Failed to retrieve created ticket");
    }

    return ticket;
  }

  GetTicket(id: number): Ticket | null {
    const stmt = this.db.prepare("SELECT * FROM tickets WHERE id = ?");
    return stmt.get(id) as Ticket | null;
  }

  GetTicketByChannel(channel_id: string): Ticket | null {
    const stmt = this.db.prepare("SELECT * FROM tickets WHERE channel_id = ?");
    return stmt.get(channel_id) as Ticket | null;
  }

  GetUserTickets(user_id: string, guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ?"
    );
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = ?"
      );
      return stmt.all(user_id, guild_id, status) as Ticket[];
    }
    return stmt.all(user_id, guild_id) as Ticket[];
  }

  GetGuildTickets(guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare("SELECT * FROM tickets WHERE guild_id = ?");
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE guild_id = ? AND status = ?"
      );
      return stmt.all(guild_id, status) as Ticket[];
    }
    return stmt.all(guild_id) as Ticket[];
  }

  UpdateTicketStatus(
    id: number,
    status: string,
    claimed_by?: string | null
  ): boolean {
    const stmt = this.db.prepare(
      "UPDATE tickets SET status = ?, claimed_by = ? WHERE id = ?"
    );
    const result = stmt.run(status, claimed_by ?? null, id);
    return result.changes > 0;
  }

  UpdateTicketChannelId(id: number, channel_id: string): boolean {
    const stmt = this.db.prepare(
      "UPDATE tickets SET channel_id = ? WHERE id = ?"
    );
    const result = stmt.run(channel_id, id);
    return result.changes > 0;
  }

  CloseTicket(id: number, claimed_by?: string | null): boolean {
    const closed_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE tickets SET status = ?, claimed_by = ?, closed_at = ? WHERE id = ?"
    );
    const result = stmt.run("closed", claimed_by ?? null, closed_at, id);
    return result.changes > 0;
  }

  AddMessage(
    ticket_id: number,
    user_id: string,
    content: string
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
      "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY timestamp ASC"
    );
    return stmt.all(ticket_id) as TicketMessage[];
  }

  DeleteTicket(id: number): boolean {
    const stmt = this.db.prepare("DELETE FROM tickets WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  AddParticipant(
    ticket_id: number,
    user_id: string,
    added_by: string
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
      "SELECT * FROM ticket_participants WHERE ticket_id = ? ORDER BY added_at ASC"
    );
    return stmt.all(ticket_id) as TicketParticipant[];
  }

  GetActiveParticipants(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? AND removed_by IS NULL ORDER BY added_at ASC"
    );
    return stmt.all(ticket_id) as TicketParticipant[];
  }

  GetParticipantHistory(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? ORDER BY added_at ASC"
    );
    return stmt.all(ticket_id) as TicketParticipant[];
  }

  RemoveParticipant(
    ticket_id: number,
    user_id: string,
    removed_by: string
  ): boolean {
    const removed_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE ticket_participants SET removed_by = ?, removed_at = ? WHERE ticket_id = ? AND user_id = ? AND removed_by IS NULL"
    );
    const result = stmt.run(removed_by, removed_at, ticket_id, user_id);
    return result.changes > 0;
  }

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
      created_at
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
      "SELECT * FROM ticket_reopen_audits WHERE prior_ticket_id = ? ORDER BY created_at DESC"
    );

    return stmt.all(ticket_id) as TicketReopenAudit[];
  }

  Close(): void {
    this.db.close();
  }
}
