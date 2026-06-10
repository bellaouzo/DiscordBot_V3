import type Database from "better-sqlite3";
import { MapLockdown } from "@database/Moderation/Mappers";
import type { Lockdown, LockdownScope } from "@database/Moderation/Types";

export class LockdownStore {
  constructor(private readonly db: Database.Database) {}

  AddLockdown(data: {
    scope: LockdownScope;
    guild_id: string;
    target_id: string;
    applied_by: string;
    overwrites: string;
  }): Lockdown {
    const applied_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO lockdowns (scope, guild_id, target_id, applied_by, applied_at, overwrites, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const id = stmt.run(
      data.scope,
      data.guild_id,
      data.target_id,
      data.applied_by,
      applied_at,
      data.overwrites,
    ).lastInsertRowid as number;

    const record = this.GetLockdownById(id);
    if (!record) {
      throw new Error("Failed to create lockdown record");
    }

    return record;
  }

  GetLockdownById(id: number): Lockdown | null {
    const stmt = this.db.prepare("SELECT * FROM lockdowns WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? MapLockdown(row) : null;
  }

  GetActiveLockdown(
    scope: LockdownScope,
    guild_id: string,
    target_id: string,
  ): Lockdown | null {
    const stmt = this.db.prepare(
      "SELECT * FROM lockdowns WHERE scope = ? AND guild_id = ? AND target_id = ? AND active = 1",
    );
    const row = stmt.get(scope, guild_id, target_id) as
      | Record<string, unknown>
      | undefined;
    return row ? MapLockdown(row) : null;
  }

  ListActiveLockdowns(guild_id: string): Lockdown[] {
    const stmt = this.db.prepare(
      "SELECT * FROM lockdowns WHERE guild_id = ? AND active = 1 ORDER BY applied_at DESC",
    );
    const rows = stmt.all(guild_id) as Record<string, unknown>[];
    return rows.map((row) => MapLockdown(row));
  }

  MarkLockdownLifted(id: number): boolean {
    const lifted_at = Date.now();
    const stmt = this.db.prepare(
      "UPDATE lockdowns SET active = 0, lifted_at = ? WHERE id = ?",
    );
    const result = stmt.run(lifted_at, id);
    return result.changes > 0;
  }
}
