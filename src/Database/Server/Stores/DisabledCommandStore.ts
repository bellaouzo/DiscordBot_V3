import type Database from "better-sqlite3";

export class DisabledCommandStore {
  constructor(private readonly db: Database.Database) {}

  IsCommandDisabled(guild_id: string, command_name: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM guild_disabled_commands WHERE guild_id = ? AND command_name = ?",
      )
      .get(guild_id, command_name);

    return Boolean(row);
  }

  DisableCommand(guild_id: string, command_name: string): void {
    this.db
      .prepare(
        `
        INSERT OR IGNORE INTO guild_disabled_commands (guild_id, command_name)
        VALUES (?, ?)
      `,
      )
      .run(guild_id, command_name);
  }

  EnableCommand(guild_id: string, command_name: string): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM guild_disabled_commands WHERE guild_id = ? AND command_name = ?",
      )
      .run(guild_id, command_name);

    return result.changes > 0;
  }

  ListDisabledCommands(guild_id: string): string[] {
    const rows = this.db
      .prepare(
        "SELECT command_name FROM guild_disabled_commands WHERE guild_id = ? ORDER BY command_name ASC",
      )
      .all(guild_id) as Array<{ command_name: string }>;

    return rows.map((row) => row.command_name);
  }
}
