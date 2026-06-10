import type Database from "better-sqlite3";
import type { MarketRotation } from "@systems/Economy/types";
import { isStringArray, SafeParseJson } from "@utilities/SafeJson";

export class MarketRotationStore {
  constructor(private readonly db: Database.Database) {}

  SetMarketRotation(rotation: MarketRotation): void {
    this.db
      .prepare(
        `
        INSERT INTO market_rotations (guild_id, items, generated_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET items = excluded.items, generated_at = excluded.generated_at, expires_at = excluded.expires_at
      `,
      )
      .run(
        rotation.guildId,
        JSON.stringify(rotation.items),
        rotation.generatedAt,
        rotation.expiresAt,
      );
  }

  GetMarketRotation(guild_id: string): MarketRotation | null {
    const stmt = this.db.prepare(
      `
      SELECT guild_id, items, generated_at, expires_at
      FROM market_rotations
      WHERE guild_id = ?
    `,
    );

    const row = stmt.get(guild_id) as
      | {
          guild_id: string;
          items: string;
          generated_at: number;
          expires_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    const itemsResult = SafeParseJson(row.items, isStringArray);
    return {
      guildId: row.guild_id,
      items: itemsResult.success && itemsResult.data ? itemsResult.data : [],
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
    };
  }
}
