import Database from "better-sqlite3";
import type { InventoryEntry } from "@systems/Economy/types";

export class InventoryStore {
  constructor(private readonly db: Database.Database) {}

  GetInventory(user_id: string, guild_id: string): InventoryEntry[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, guild_id, item_id, quantity, updated_at
      FROM inventories
      WHERE user_id = ? AND guild_id = ?
    `,
    );

    const rows = stmt.all(user_id, guild_id) as {
      user_id: string;
      guild_id: string;
      item_id: string;
      quantity: number;
      updated_at: number;
    }[];

    return rows.map((row) => ({
      userId: row.user_id,
      guildId: row.guild_id,
      itemId: row.item_id,
      quantity: row.quantity,
      updatedAt: row.updated_at,
    }));
  }

  GetInventoryItem(
    user_id: string,
    guild_id: string,
    item_id: string,
  ): InventoryEntry | null {
    const stmt = this.db.prepare(
      `
      SELECT user_id, guild_id, item_id, quantity, updated_at
      FROM inventories
      WHERE user_id = ? AND guild_id = ? AND item_id = ?
    `,
    );

    const row = stmt.get(user_id, guild_id, item_id) as
      | {
          user_id: string;
          guild_id: string;
          item_id: string;
          quantity: number;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      guildId: row.guild_id,
      itemId: row.item_id,
      quantity: row.quantity,
      updatedAt: row.updated_at,
    };
  }

  AdjustInventoryQuantity(data: {
    user_id: string;
    guild_id: string;
    item_id: string;
    delta: number;
    maxStack?: number;
  }): InventoryEntry {
    const transaction = this.db.transaction(() => {
      const current = this.GetInventoryItem(
        data.user_id,
        data.guild_id,
        data.item_id,
      );
      const updated_at = Date.now();
      const nextQuantity = Math.max(
        0,
        Math.min(
          data.maxStack ?? Number.MAX_SAFE_INTEGER,
          (current?.quantity ?? 0) + data.delta,
        ),
      );

      if (nextQuantity === 0) {
        if (current) {
          this.db
            .prepare(
              "DELETE FROM inventories WHERE user_id = ? AND guild_id = ? AND item_id = ?",
            )
            .run(data.user_id, data.guild_id, data.item_id);
        }

        return {
          userId: data.user_id,
          guildId: data.guild_id,
          itemId: data.item_id,
          quantity: 0,
          updatedAt: updated_at,
        };
      }

      this.db
        .prepare(
          `
          INSERT INTO inventories (user_id, guild_id, item_id, quantity, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at
        `,
        )
        .run(
          data.user_id,
          data.guild_id,
          data.item_id,
          nextQuantity,
          updated_at,
        );

      return {
        userId: data.user_id,
        guildId: data.guild_id,
        itemId: data.item_id,
        quantity: nextQuantity,
        updatedAt: updated_at,
      };
    });

    return transaction();
  }
}
