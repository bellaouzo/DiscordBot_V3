import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { RunMigrations } from "@database/Migrations/MigrationRunner";
import type { Migration } from "@database/Migrations/types";
import { createMockLogger } from "../helpers";

describe("MigrationRunner", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("applies pending migrations in version order", () => {
    const calls: string[] = [];
    const migrations: Migration[] = [
      {
        version: 2,
        name: "second",
        up() {
          calls.push("second");
        },
      },
      {
        version: 1,
        name: "first",
        up() {
          calls.push("first");
          db.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY)");
        },
      },
    ];

    RunMigrations(db, migrations, createMockLogger());

    expect(calls).toEqual(["first", "second"]);
    const rows = db
      .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number; name: string }>;
    expect(rows).toEqual([
      { version: 1, name: "first" },
      { version: 2, name: "second" },
    ]);
  });

  it("skips migrations that were already applied", () => {
    const up = vi.fn();
    const migrations: Migration[] = [
      { version: 1, name: "once", up: up.mockImplementation(() => undefined) },
    ];

    RunMigrations(db, migrations);
    RunMigrations(db, migrations);

    expect(up).toHaveBeenCalledTimes(1);
  });

  it("rolls back failed migrations", () => {
    const migrations: Migration[] = [
      {
        version: 1,
        name: "failing",
        up() {
          throw new Error("migration failed");
        },
      },
    ];

    expect(() => RunMigrations(db, migrations)).toThrow("migration failed");
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };
    expect(count.count).toBe(0);
  });
});
