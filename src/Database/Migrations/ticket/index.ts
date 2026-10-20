import { HasTableColumn } from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";

// Baseline schema, frozen. Idempotent so it is a no-op on databases created before
// migrations owned the schema. Never edit it: add a new migration version instead.
const TICKET_INITIAL_SCHEMA = `
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      claimed_by TEXT,
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      close_reason TEXT
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
`;

export const TicketMigrations: readonly Migration[] = [
  {
    version: 0,
    name: "initial_schema",
    up(db) {
      db.exec(TICKET_INITIAL_SCHEMA);
    },
  },
  {
    version: 1,
    name: "ticket_participants_removed_columns",
    up(db) {
      if (HasTableColumn(db, "ticket_participants", "removed_by")) {
        return;
      }

      db.exec(`
        ALTER TABLE ticket_participants ADD COLUMN removed_by TEXT;
        ALTER TABLE ticket_participants ADD COLUMN removed_at INTEGER;
      `);
    },
  },
  {
    version: 2,
    name: "add_close_reason_to_tickets",
    up(db) {
      if (HasTableColumn(db, "tickets", "close_reason")) {
        return;
      }
      db.exec(`
        ALTER TABLE tickets ADD COLUMN close_reason TEXT;
      `);
    },
  },
];
