import type Database from "better-sqlite3";

export interface EconomyLottery {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  entry_cost: number;
  ends_at: number;
  ended: boolean;
  winner_id: string | null;
  pot: number;
  created_at: number;
}

type LotteryRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  entry_cost: number;
  ends_at: number;
  ended: number;
  winner_id: string | null;
  pot: number;
  created_at: number;
};

function MapLottery(row: LotteryRow): EconomyLottery {
  return {
    ...row,
    ended: Boolean(row.ended),
  };
}

export class LotteryStore {
  constructor(private readonly db: Database.Database) {}

  CreateLottery(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    host_id: string;
    entry_cost: number;
    ends_at: number;
  }): EconomyLottery {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO economy_lotteries (
        guild_id, channel_id, message_id, host_id, entry_cost, ends_at, ended, winner_id, pot, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 0, ?)
    `);
    const id = stmt.run(
      data.guild_id,
      data.channel_id,
      data.message_id,
      data.host_id,
      data.entry_cost,
      data.ends_at,
      created_at,
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM economy_lotteries WHERE id = ?")
      .get(id) as LotteryRow;

    return MapLottery(row);
  }

  GetLotteryById(id: number): EconomyLottery | null {
    const row = this.db
      .prepare("SELECT * FROM economy_lotteries WHERE id = ?")
      .get(id) as LotteryRow | undefined;

    return row ? MapLottery(row) : null;
  }

  GetLotteryByMessageId(message_id: string): EconomyLottery | null {
    const row = this.db
      .prepare("SELECT * FROM economy_lotteries WHERE message_id = ?")
      .get(message_id) as LotteryRow | undefined;

    return row ? MapLottery(row) : null;
  }

  GetActiveLotteries(guild_id: string): EconomyLottery[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM economy_lotteries WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC",
      )
      .all(guild_id) as LotteryRow[];

    return rows.map(MapLottery);
  }

  GetEndedLotteriesToProcess(): EconomyLottery[] {
    const now = Date.now();
    const rows = this.db
      .prepare(
        "SELECT * FROM economy_lotteries WHERE ended = 0 AND ends_at <= ?",
      )
      .all(now) as LotteryRow[];

    return rows.map(MapLottery);
  }

  AddEntry(lottery_id: number, user_id: string, entry_cost: number): boolean {
    const now = Date.now();
    const transaction = this.db.transaction(() => {
      const insert = this.db.prepare(`
        INSERT INTO economy_lottery_entries (lottery_id, user_id, created_at)
        VALUES (?, ?, ?)
      `);
      insert.run(lottery_id, user_id, now);

      this.db
        .prepare("UPDATE economy_lotteries SET pot = pot + ? WHERE id = ?")
        .run(entry_cost, lottery_id);
    });

    try {
      transaction();
      return true;
    } catch {
      return false;
    }
  }

  HasEntry(lottery_id: number, user_id: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM economy_lottery_entries WHERE lottery_id = ? AND user_id = ?",
      )
      .get(lottery_id, user_id);

    return Boolean(row);
  }

  GetEntries(lottery_id: number): string[] {
    const rows = this.db
      .prepare(
        "SELECT user_id FROM economy_lottery_entries WHERE lottery_id = ?",
      )
      .all(lottery_id) as Array<{ user_id: string }>;

    return rows.map((row) => row.user_id);
  }

  EndLottery(id: number, winner_id: string | null): boolean {
    const result = this.db
      .prepare(
        "UPDATE economy_lotteries SET ended = 1, winner_id = ? WHERE id = ? AND ended = 0",
      )
      .run(winner_id, id);

    return result.changes > 0;
  }
}
