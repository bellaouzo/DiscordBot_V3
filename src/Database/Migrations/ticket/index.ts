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
];
