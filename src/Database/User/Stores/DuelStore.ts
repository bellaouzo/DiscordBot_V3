import type Database from "better-sqlite3";

export type DuelGame = "rps" | "flip";
export type DuelStatus = "pending" | "active" | "completed" | "cancelled";

export interface EconomyDuel {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  challenger_id: string;
  opponent_id: string;
  bet: number;
  game: DuelGame;
  status: DuelStatus;
  winner_id: string | null;
  expires_at: number;
  created_at: number;
}

type DuelRow = {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  challenger_id: string;
  opponent_id: string;
  bet: number;
  game: DuelGame;
  status: DuelStatus;
  winner_id: string | null;
  expires_at: number;
  created_at: number;
};

function MapDuel(row: DuelRow): EconomyDuel {
  return { ...row };
}

export class DuelStore {
  constructor(private readonly db: Database.Database) {}

  CreateDuel(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    challenger_id: string;
    opponent_id: string;
    bet: number;
    game: DuelGame;
    expires_at: number;
  }): EconomyDuel {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO economy_duels (
        guild_id, channel_id, message_id, challenger_id, opponent_id,
        bet, game, status, winner_id, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
    `);
    const id = stmt.run(
      data.guild_id,
      data.channel_id,
      data.message_id,
      data.challenger_id,
      data.opponent_id,
      data.bet,
      data.game,
      data.expires_at,
      created_at,
    ).lastInsertRowid as number;

    const row = this.db
      .prepare("SELECT * FROM economy_duels WHERE id = ?")
      .get(id) as DuelRow;

    return MapDuel(row);
  }

  GetDuelById(id: number): EconomyDuel | null {
    const row = this.db
      .prepare("SELECT * FROM economy_duels WHERE id = ?")
      .get(id) as DuelRow | undefined;

    return row ? MapDuel(row) : null;
  }

  GetDuelByMessageId(message_id: string): EconomyDuel | null {
    const row = this.db
      .prepare("SELECT * FROM economy_duels WHERE message_id = ?")
      .get(message_id) as DuelRow | undefined;

    return row ? MapDuel(row) : null;
  }

  ActivateDuel(id: number): boolean {
    const result = this.db
      .prepare(
        "UPDATE economy_duels SET status = 'active' WHERE id = ? AND status = 'pending'",
      )
      .run(id);

    return result.changes > 0;
  }

  CompleteDuel(id: number, winner_id: string | null): boolean {
    const result = this.db
      .prepare(
        "UPDATE economy_duels SET status = 'completed', winner_id = ? WHERE id = ? AND status = 'active'",
      )
      .run(winner_id, id);

    return result.changes > 0;
  }

  CancelDuel(id: number): boolean {
    const result = this.db
      .prepare(
        "UPDATE economy_duels SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'active')",
      )
      .run(id);

    return result.changes > 0;
  }

  ListPendingByChallenger(
    guild_id: string,
    challenger_id: string,
  ): EconomyDuel[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM economy_duels WHERE guild_id = ? AND challenger_id = ? AND status = 'pending' ORDER BY created_at DESC",
      )
      .all(guild_id, challenger_id) as DuelRow[];

    return rows.map(MapDuel);
  }
}
