import { HasTableColumn } from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";

export const TicketMigrations: readonly Migration[] = [
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
