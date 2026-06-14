import type Database from "better-sqlite3";
import type { Logger } from "@shared/Logger";
import type { Migration } from "./types";

function EnsureSchemaMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}

function ListAppliedVersions(db: Database.Database): Set<number> {
  const rows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as Array<{ version: number }>;
  return new Set(rows.map((row) => row.version));
}

export function RunMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
  logger?: Logger,
): void {
  EnsureSchemaMigrationsTable(db);
  const applied = ListAppliedVersions(db);

  const ordered = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of ordered) {
    if (applied.has(migration.version)) {
      continue;
    }

    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, Date.now());
    });

    apply();
    logger?.Info("Applied database migration", {
      extra: { version: migration.version, name: migration.name },
    });
  }
}

export function HasTableColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
): boolean {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

export function AddTableColumnIfMissing(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnType: string,
): void {
  if (HasTableColumn(db, tableName, columnName)) {
    return;
  }

  db.prepare(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`,
  ).run();
}

export function AddTableColumnsIfMissing(
  db: Database.Database,
  tableName: string,
  columns: ReadonlyArray<readonly [string, string]>,
): void {
  for (const [name, type] of columns) {
    AddTableColumnIfMissing(db, tableName, name, type);
  }
}
