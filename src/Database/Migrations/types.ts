import type Database from "better-sqlite3";

export interface Migration {
  readonly version: number;
  readonly name: string;
  up(db: Database.Database): void;
}

export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly applied_at: number;
}
