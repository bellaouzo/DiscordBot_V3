import type Database from "better-sqlite3";

/**
 * Per-guild channel allow-lists for commands. A command with no rows can be used anywhere.
 */
export class CommandChannelStore {
  constructor(private readonly db: Database.Database) {}

  ListCommandChannels(guild_id: string, command_name: string): string[] {
    const rows = this.db
      .prepare(
        "SELECT channel_id FROM guild_command_channels WHERE guild_id = ? AND command_name = ? ORDER BY channel_id ASC",
      )
      .all(guild_id, command_name) as Array<{ channel_id: string }>;
    return rows.map((row) => row.channel_id);
  }

  /** Returns false when the channel was already allowed. */
  AddCommandChannel(
    guild_id: string,
    command_name: string,
    channel_id: string,
  ): boolean {
    const result = this.db
      .prepare(
        `
        INSERT OR IGNORE INTO guild_command_channels (guild_id, command_name, channel_id)
        VALUES (?, ?, ?)
      `,
      )
      .run(guild_id, command_name, channel_id);
    return result.changes > 0;
  }

  RemoveCommandChannel(
    guild_id: string,
    command_name: string,
    channel_id: string,
  ): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM guild_command_channels WHERE guild_id = ? AND command_name = ? AND channel_id = ?",
      )
      .run(guild_id, command_name, channel_id);
    return result.changes > 0;
  }

  /** Removes every channel restriction for the command. Returns how many were removed. */
  ClearCommandChannels(guild_id: string, command_name: string): number {
    const result = this.db
      .prepare(
        "DELETE FROM guild_command_channels WHERE guild_id = ? AND command_name = ?",
      )
      .run(guild_id, command_name);
    return result.changes;
  }
}
