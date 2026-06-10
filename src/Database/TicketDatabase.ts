import Database from "better-sqlite3";
import { Logger } from "@shared/Logger";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";

export type TicketStatus = "open" | "claimed" | "closed";

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === "open" || value === "claimed" || value === "closed";
}

export interface Ticket {
  id: number;
  user_id: string;
  guild_id: string;
  channel_id: string | null;
  category: string;
  status: TicketStatus;
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

export interface TicketTag {
  id: number;
  ticket_id: number;
  tag: string;
  created_at: number;
}

export interface TicketCategory {
  value: string;
  label: string;
  description: string;
  emoji: string;
}

export interface TicketCategoryConfig extends TicketCategory {
  id: number;
  guild_id: string;
  sort_order: number;
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

  private MapTicket(row: Record<string, unknown>): Ticket {
    const status = row.status;
    if (!isTicketStatus(status)) {
      throw new Error(`Invalid ticket status: ${status}`);
    }
    return {
      id: Number(row.id),
      user_id: String(row.user_id),
      guild_id: String(row.guild_id),
      channel_id: row.channel_id ? String(row.channel_id) : null,
      category: String(row.category),
      status,
      claimed_by: row.claimed_by ? String(row.claimed_by) : null,
      created_at: Number(row.created_at),
      closed_at: row.closed_at ? Number(row.closed_at) : null,
    };
  }

  private MapTicketMessage(row: Record<string, unknown>): TicketMessage {
    return {
      id: Number(row.id),
      ticket_id: Number(row.ticket_id),
      user_id: String(row.user_id),
      content: String(row.content),
      timestamp: Number(row.timestamp),
    };
  }

  private MapTicketParticipant(
    row: Record<string, unknown>
  ): TicketParticipant {
    return {
      id: Number(row.id),
      ticket_id: Number(row.ticket_id),
      user_id: String(row.user_id),
      added_by: String(row.added_by),
      added_at: Number(row.added_at),
      removed_by: row.removed_by ? String(row.removed_by) : undefined,
      removed_at: row.removed_at ? Number(row.removed_at) : undefined,
    };
  }

  private MapTicketReopenAudit(
    row: Record<string, unknown>
  ): TicketReopenAudit {
    return {
      id: Number(row.id),
      prior_ticket_id: Number(row.prior_ticket_id),
      new_ticket_id: Number(row.new_ticket_id),
      guild_id: String(row.guild_id),
      reopened_by: String(row.reopened_by),
      reason: row.reason ? String(row.reason) : null,
      prior_status: row.prior_status ? String(row.prior_status) : null,
      transcript_url: row.transcript_url ? String(row.transcript_url) : null,
      created_at: Number(row.created_at),
    };
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "tickets.db");

    try {
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

      CREATE TABLE IF NOT EXISTS ticket_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(ticket_id, tag),
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket ON ticket_tags(ticket_id);

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

      CREATE TABLE IF NOT EXISTS ticket_category_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        emoji TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE(guild_id, value)
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_category_configs_guild ON ticket_category_configs(guild_id);
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
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.MapTicket(row) : null;
  }

  GetTicketByChannel(channel_id: string): Ticket | null {
    const stmt = this.db.prepare("SELECT * FROM tickets WHERE channel_id = ?");
    const row = stmt.get(channel_id) as Record<string, unknown> | undefined;
    return row ? this.MapTicket(row) : null;
  }

  GetUserTickets(user_id: string, guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ?"
    );
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = ?"
      );
      const rows = stmt.all(user_id, guild_id, status) as Record<
        string,
        unknown
      >[];
      return rows.map((row) => this.MapTicket(row));
    }
    const rows = stmt.all(user_id, guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicket(row));
  }

  GetActiveUserTickets(user_id: string, guild_id: string): Ticket[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status IN ('open', 'claimed') ORDER BY created_at DESC"
    );
    const rows = stmt.all(user_id, guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicket(row));
  }

  GetGuildTickets(guild_id: string, status?: string): Ticket[] {
    let stmt = this.db.prepare("SELECT * FROM tickets WHERE guild_id = ?");
    if (status) {
      stmt = this.db.prepare(
        "SELECT * FROM tickets WHERE guild_id = ? AND status = ?"
      );
      const rows = stmt.all(guild_id, status) as Record<string, unknown>[];
      return rows.map((row) => this.MapTicket(row));
    }
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicket(row));
  }

  GetActiveGuildTickets(guild_id: string): Ticket[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tickets WHERE guild_id = ? AND status IN ('open', 'claimed') ORDER BY created_at ASC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicket(row));
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
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicketMessage(row));
  }

  DeleteTicket(id: number): boolean {
    const stmt = this.db.prepare("DELETE FROM tickets WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

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
      "DELETE FROM ticket_tags WHERE ticket_id = ? AND tag = ?"
    );
    const result = stmt.run(ticket_id, normalized);
    return result.changes > 0;
  }

  ListTicketTags(ticket_id: number): string[] {
    const stmt = this.db.prepare(
      "SELECT tag FROM ticket_tags WHERE ticket_id = ? ORDER BY tag ASC"
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
      `SELECT ticket_id, tag FROM ticket_tags WHERE ticket_id IN (${placeholders}) ORDER BY tag ASC`
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
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicketParticipant(row));
  }

  GetActiveParticipants(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? AND removed_by IS NULL ORDER BY added_at ASC"
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicketParticipant(row));
  }

  GetParticipantHistory(ticket_id: number): TicketParticipant[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_participants WHERE ticket_id = ? ORDER BY added_at ASC"
    );
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicketParticipant(row));
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
    const rows = stmt.all(ticket_id) as Record<string, unknown>[];
    return rows.map((row) => this.MapTicketReopenAudit(row));
  }

  EnsureCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    const existing = this.GetCategoryConfigs(guild_id);
    if (existing.length > 0) {
      return existing;
    }

    const insert = this.db.prepare(`
      INSERT INTO ticket_category_configs (guild_id, value, label, description, emoji, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    TICKET_CATEGORIES.forEach((category, index) => {
      insert.run(
        guild_id,
        category.value,
        category.label,
        category.description,
        category.emoji,
        index
      );
    });

    return this.GetCategoryConfigs(guild_id);
  }

  GetCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_category_configs WHERE guild_id = ? ORDER BY sort_order ASC, id ASC"
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      guild_id: String(row.guild_id),
      value: String(row.value),
      label: String(row.label),
      description: String(row.description),
      emoji: String(row.emoji),
      sort_order: Number(row.sort_order),
    }));
  }

  GetCategoryConfig(
    guild_id: string,
    value: string
  ): TicketCategoryConfig | null {
    const stmt = this.db.prepare(
      "SELECT * FROM ticket_category_configs WHERE guild_id = ? AND value = ?"
    );
    const row = stmt.get(guild_id, value) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      guild_id: String(row.guild_id),
      value: String(row.value),
      label: String(row.label),
      description: String(row.description),
      emoji: String(row.emoji),
      sort_order: Number(row.sort_order),
    };
  }

  AddCategoryConfig(data: {
    guild_id: string;
    value: string;
    label: string;
    description: string;
    emoji: string;
    sort_order?: number;
  }): TicketCategoryConfig {
    const configs = this.GetCategoryConfigs(data.guild_id);
    const sortOrder = data.sort_order ?? configs.length;
    const stmt = this.db.prepare(`
      INSERT INTO ticket_category_configs (guild_id, value, label, description, emoji, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.guild_id,
      data.value.trim().toLowerCase(),
      data.label.trim(),
      data.description.trim(),
      data.emoji.trim(),
      sortOrder
    ).lastInsertRowid as number;

    const config = this.db
      .prepare("SELECT * FROM ticket_category_configs WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return {
      id: Number(config.id),
      guild_id: String(config.guild_id),
      value: String(config.value),
      label: String(config.label),
      description: String(config.description),
      emoji: String(config.emoji),
      sort_order: Number(config.sort_order),
    };
  }

  UpdateCategoryConfig(
    guild_id: string,
    value: string,
    updates: {
      label?: string;
      description?: string;
      emoji?: string;
      sort_order?: number;
    }
  ): TicketCategoryConfig | null {
    const existing = this.GetCategoryConfig(guild_id, value);
    if (!existing) {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE ticket_category_configs
      SET label = ?, description = ?, emoji = ?, sort_order = ?
      WHERE guild_id = ? AND value = ?
    `);

    stmt.run(
      updates.label ?? existing.label,
      updates.description ?? existing.description,
      updates.emoji ?? existing.emoji,
      updates.sort_order ?? existing.sort_order,
      guild_id,
      value
    );

    return this.GetCategoryConfig(guild_id, value);
  }

  RemoveCategoryConfig(guild_id: string, value: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM ticket_category_configs WHERE guild_id = ? AND value = ?"
    );
    const result = stmt.run(guild_id, value);
    return result.changes > 0;
  }

  Close(): void {
    this.db.close();
  }
}
