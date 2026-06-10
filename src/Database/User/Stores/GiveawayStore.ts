import type Database from "better-sqlite3";
import { ParseWinners } from "@database/User/Mappers";
import type { Giveaway } from "@database/User/Types";

type GiveawayRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  prize: string;
  winner_count: number;
  ends_at: number;
  ended: number;
  winners: string | null;
  created_at: number;
};

function MapGiveawayRow(row: GiveawayRow): Giveaway {
  return {
    ...row,
    ended: row.ended === 1,
    winners: ParseWinners(row.winners),
  };
}

export class GiveawayStore {
  constructor(private readonly db: Database.Database) {}

  CreateGiveaway(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    host_id: string;
    prize: string;
    winner_count: number;
    ends_at: number;
  }): Giveaway {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winner_count, ends_at, ended, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(
      data.guild_id,
      data.channel_id,
      data.message_id,
      data.host_id,
      data.prize,
      data.winner_count,
      data.ends_at,
      now,
    );

    const created = this.GetGiveawayByMessageId(data.message_id);
    if (!created) {
      throw new Error("Failed to load created giveaway");
    }
    return created;
  }

  GetGiveawayByMessageId(message_id: string): Giveaway | null {
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE message_id = ?",
    );
    const row = stmt.get(message_id) as GiveawayRow | undefined;

    if (!row) return null;

    return MapGiveawayRow(row);
  }

  GetActiveGiveaways(guild_id: string): Giveaway[] {
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC",
    );
    const rows = stmt.all(guild_id) as GiveawayRow[];

    return rows.map((row) => MapGiveawayRow(row));
  }

  GetEndedGiveawaysToProcess(): Giveaway[] {
    const now = Date.now();
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?",
    );
    const rows = stmt.all(now) as GiveawayRow[];

    return rows.map((row) => MapGiveawayRow(row));
  }

  AddGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    const now = Date.now();
    try {
      this.db
        .prepare(
          `
          INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at)
          VALUES (?, ?, ?)
        `,
        )
        .run(giveaway_id, user_id, now);
      return true;
    } catch {
      return false;
    }
  }

  RemoveGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?",
      )
      .run(giveaway_id, user_id);
    return result.changes > 0;
  }

  HasEnteredGiveaway(giveaway_id: number, user_id: string): boolean {
    const stmt = this.db.prepare(
      "SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?",
    );
    return stmt.get(giveaway_id, user_id) !== undefined;
  }

  GetGiveawayEntries(giveaway_id: number): string[] {
    const stmt = this.db.prepare(
      "SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?",
    );
    const rows = stmt.all(giveaway_id) as { user_id: string }[];
    return rows.map((r) => r.user_id);
  }

  GetGiveawayEntryCount(giveaway_id: number): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?",
    );
    const row = stmt.get(giveaway_id) as { count: number };
    return row.count;
  }

  EndGiveaway(message_id: string, winnerIds: string[]): boolean {
    const result = this.db
      .prepare(
        `
        UPDATE giveaways
        SET ended = 1, winners = ?
        WHERE message_id = ?
      `,
      )
      .run(JSON.stringify(winnerIds), message_id);
    return result.changes > 0;
  }
}
