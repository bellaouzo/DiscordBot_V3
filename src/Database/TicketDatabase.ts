import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
import type {
  Ticket,
  TicketCategoryConfig,
  TicketMessage,
  TicketParticipant,
  TicketReopenAudit,
} from "@database/Ticket/Types";
import { TicketStore } from "@database/Ticket/Stores/TicketStore";
import { TicketMessageStore } from "@database/Ticket/Stores/TicketMessageStore";
import { TicketTagStore } from "@database/Ticket/Stores/TicketTagStore";
import { TicketParticipantStore } from "@database/Ticket/Stores/TicketParticipantStore";
import { TicketReopenAuditStore } from "@database/Ticket/Stores/TicketReopenAuditStore";
import { TicketCategoryConfigStore } from "@database/Ticket/Stores/TicketCategoryConfigStore";

export type {
  Ticket,
  TicketCategory,
  TicketCategoryConfig,
  TicketMessage,
  TicketParticipant,
  TicketReopenAudit,
  TicketStatus,
  TicketTag,
} from "@database/Ticket/Types";

export { TICKET_CATEGORIES } from "@database/Ticket/Types";

export class TicketDatabase {
  private readonly db: Database.Database;
  private readonly tickets: TicketStore;
  private readonly messages: TicketMessageStore;
  private readonly tags: TicketTagStore;
  private readonly participants: TicketParticipantStore;
  private readonly reopenAudits: TicketReopenAuditStore;
  private readonly categoryConfigs: TicketCategoryConfigStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.tickets = new TicketStore(this.db);
    this.messages = new TicketMessageStore(this.db);
    this.tags = new TicketTagStore(this.db);
    this.participants = new TicketParticipantStore(this.db);
    this.reopenAudits = new TicketReopenAuditStore(this.db);
    this.categoryConfigs = new TicketCategoryConfigStore(this.db);
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

    this.MigrateDatabase();
  }

  private MigrateDatabase(): void {
    try {
      const tableInfo = this.db
        .prepare<
          unknown[],
          { name: string }
        >("PRAGMA table_info(ticket_participants)")
        .all();
      const hasRemovedBy = tableInfo.some(
        (column) => column.name === "removed_by",
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
    return this.tickets.CreateTicket(data);
  }

  GetTicket(id: number): Ticket | null {
    return this.tickets.GetTicket(id);
  }

  GetTicketByChannel(channel_id: string): Ticket | null {
    return this.tickets.GetTicketByChannel(channel_id);
  }

  GetUserTickets(user_id: string, guild_id: string, status?: string): Ticket[] {
    return this.tickets.GetUserTickets(user_id, guild_id, status);
  }

  GetActiveUserTickets(user_id: string, guild_id: string): Ticket[] {
    return this.tickets.GetActiveUserTickets(user_id, guild_id);
  }

  GetGuildTickets(guild_id: string, status?: string): Ticket[] {
    return this.tickets.GetGuildTickets(guild_id, status);
  }

  GetActiveGuildTickets(guild_id: string): Ticket[] {
    return this.tickets.GetActiveGuildTickets(guild_id);
  }

  UpdateTicketStatus(
    id: number,
    status: string,
    claimed_by?: string | null,
  ): boolean {
    return this.tickets.UpdateTicketStatus(id, status, claimed_by);
  }

  UpdateTicketChannelId(id: number, channel_id: string): boolean {
    return this.tickets.UpdateTicketChannelId(id, channel_id);
  }

  CloseTicket(id: number, claimed_by?: string | null): boolean {
    return this.tickets.CloseTicket(id, claimed_by);
  }

  AddMessage(
    ticket_id: number,
    user_id: string,
    content: string,
  ): TicketMessage {
    return this.messages.AddMessage(ticket_id, user_id, content);
  }

  GetTicketMessages(ticket_id: number): TicketMessage[] {
    return this.messages.GetTicketMessages(ticket_id);
  }

  DeleteTicket(id: number): boolean {
    return this.tickets.DeleteTicket(id);
  }

  AddTicketTag(ticket_id: number, tag: string): boolean {
    return this.tags.AddTicketTag(ticket_id, tag);
  }

  RemoveTicketTag(ticket_id: number, tag: string): boolean {
    return this.tags.RemoveTicketTag(ticket_id, tag);
  }

  ListTicketTags(ticket_id: number): string[] {
    return this.tags.ListTicketTags(ticket_id);
  }

  GetTagsForTickets(ticketIds: number[]): Record<number, string[]> {
    return this.tags.GetTagsForTickets(ticketIds);
  }

  AddParticipant(
    ticket_id: number,
    user_id: string,
    added_by: string,
  ): TicketParticipant {
    return this.participants.AddParticipant(ticket_id, user_id, added_by);
  }

  GetParticipants(ticket_id: number): TicketParticipant[] {
    return this.participants.GetParticipants(ticket_id);
  }

  GetActiveParticipants(ticket_id: number): TicketParticipant[] {
    return this.participants.GetActiveParticipants(ticket_id);
  }

  GetParticipantHistory(ticket_id: number): TicketParticipant[] {
    return this.participants.GetParticipantHistory(ticket_id);
  }

  RemoveParticipant(
    ticket_id: number,
    user_id: string,
    removed_by: string,
  ): boolean {
    return this.participants.RemoveParticipant(ticket_id, user_id, removed_by);
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
    return this.reopenAudits.AddReopenAudit(data);
  }

  GetReopenAuditsForTicket(ticket_id: number): TicketReopenAudit[] {
    return this.reopenAudits.GetReopenAuditsForTicket(ticket_id);
  }

  EnsureCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    return this.categoryConfigs.EnsureCategoryConfigs(guild_id);
  }

  GetCategoryConfigs(guild_id: string): TicketCategoryConfig[] {
    return this.categoryConfigs.GetCategoryConfigs(guild_id);
  }

  GetCategoryConfig(
    guild_id: string,
    value: string,
  ): TicketCategoryConfig | null {
    return this.categoryConfigs.GetCategoryConfig(guild_id, value);
  }

  AddCategoryConfig(data: {
    guild_id: string;
    value: string;
    label: string;
    description: string;
    emoji: string;
    sort_order?: number;
  }): TicketCategoryConfig {
    return this.categoryConfigs.AddCategoryConfig(data);
  }

  UpdateCategoryConfig(
    guild_id: string,
    value: string,
    updates: {
      label?: string;
      description?: string;
      emoji?: string;
      sort_order?: number;
    },
  ): TicketCategoryConfig | null {
    return this.categoryConfigs.UpdateCategoryConfig(guild_id, value, updates);
  }

  RemoveCategoryConfig(guild_id: string, value: string): boolean {
    return this.categoryConfigs.RemoveCategoryConfig(guild_id, value);
  }

  Ping(): boolean {
    const row = this.db.prepare("SELECT 1 AS ok").get() as
      | { ok: number }
      | undefined;
    return row?.ok === 1;
  }

  Close(): void {
    this.db.close();
  }
}
