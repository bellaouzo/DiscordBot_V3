import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { RunMigrations } from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";
import { UserMigrations } from "@database/Migrations/user";
import { ModerationMigrations } from "@database/Migrations/moderation";
import { ServerMigrations } from "@database/Migrations/server";
import { TicketMigrations } from "@database/Migrations/ticket";
import { createMockLogger } from "../helpers";

const SUITES: ReadonlyArray<[string, readonly Migration[]]> = [
  ["user", UserMigrations],
  ["moderation", ModerationMigrations],
  ["server", ServerMigrations],
  ["ticket", TicketMigrations],
];

function ListSchemaObjects(db: Database.Database): string[] {
  return (
    db
      .prepare(
        "SELECT type || ':' || name AS id FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY id",
      )
      .all() as Array<{ id: string }>
  ).map((row) => row.id);
}

function ListAppliedVersions(db: Database.Database): number[] {
  return (
    db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>
  ).map((row) => row.version);
}

describe.each(SUITES)("%s initial schema migration", (_name, migrations) => {
  it("is version 0 and creates the schema on a fresh database", () => {
    const db = new Database(":memory:");

    RunMigrations(db, migrations, createMockLogger());

    expect(migrations[0]).toMatchObject({ version: 0, name: "initial_schema" });
    expect(ListAppliedVersions(db)).toEqual(
      migrations.map((migration) => migration.version).sort((a, b) => a - b),
    );
    expect(ListSchemaObjects(db).length).toBeGreaterThan(0);
    db.close();
  });

  it("is a no-op on a database whose schema predates migrations", () => {
    const db = new Database(":memory:");
    // Simulate a database created by the old boot-time CREATE TABLE path.
    migrations[0].up(db);
    const before = ListSchemaObjects(db);

    RunMigrations(db, migrations, createMockLogger());

    expect(ListSchemaObjects(db)).toEqual(expect.arrayContaining(before));
    expect(ListAppliedVersions(db)).toContain(0);
    db.close();
  });
});
