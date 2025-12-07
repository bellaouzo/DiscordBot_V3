import Database from "better-sqlite3";
import * as fs from "fs";
import { Logger } from "@shared/Logger";
import type {
  InventoryEntry,
  MarketRotation,
} from "@commands/fun/economy/types";
import { join } from "path";

export interface Warning {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  reason: string | null;
  created_at: number;
}

export interface Balance {
  user_id: string;
  guild_id: string;
  balance: number;
  updated_at: number;
}

export class UserDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = join(process.cwd(), "data");
    const dbPath = join(dataDir, "users.db");

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_warnings_user_guild ON warnings(user_id, guild_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id);

      CREATE TABLE IF NOT EXISTS balances (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        balance INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE INDEX IF NOT EXISTS idx_balances_guild ON balances(guild_id);

      CREATE TABLE IF NOT EXISTS daily_claims (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        last_claim_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE INDEX IF NOT EXISTS idx_daily_claims_guild ON daily_claims(guild_id);

      CREATE TABLE IF NOT EXISTS inventories (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_inventories_guild ON inventories(guild_id);

      CREATE TABLE IF NOT EXISTS market_rotations (
        guild_id TEXT PRIMARY KEY,
        items TEXT NOT NULL,
        generated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  AddWarning(data: {
    user_id: string;
    guild_id: string;
    moderator_id: string;
    reason?: string | null;
  }): Warning {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO warnings (user_id, guild_id, moderator_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.user_id,
      data.guild_id,
      data.moderator_id,
      data.reason ?? null,
      created_at
    ).lastInsertRowid as number;

    const warning = this.GetWarningById(id, data.guild_id);
    if (!warning) {
      throw new Error("Failed to create warning");
    }

    return warning;
  }

  GetWarnings(user_id: string, guild_id: string, limit?: number): Warning[] {
    const stmt = this.db.prepare(`
      SELECT * FROM warnings
      WHERE user_id = ? AND guild_id = ?
      ORDER BY created_at ASC
      ${limit ? "LIMIT ?" : ""}
    `);

    if (limit) {
      return stmt.all(user_id, guild_id, limit) as Warning[];
    }

    return stmt.all(user_id, guild_id) as Warning[];
  }

  GetWarningById(id: number, guild_id: string): Warning | null {
    const stmt = this.db.prepare(
      "SELECT * FROM warnings WHERE id = ? AND guild_id = ?"
    );
    return stmt.get(id, guild_id) as Warning | null;
  }

  RemoveWarningById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM warnings WHERE id = ? AND guild_id = ?"
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestWarning(user_id: string, guild_id: string): Warning | null {
    const warning = this.db
      .prepare(
        `
        SELECT * FROM warnings
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(user_id, guild_id) as Warning | null;

    if (!warning) {
      return null;
    }

    const removed = this.RemoveWarningById(warning.id, guild_id);
    return removed ? warning : null;
  }

  GetBalance(user_id: string, guild_id: string): Balance | null {
    const stmt = this.db.prepare(
      "SELECT * FROM balances WHERE user_id = ? AND guild_id = ?"
    );
    return stmt.get(user_id, guild_id) as Balance | null;
  }

  EnsureBalance(
    user_id: string,
    guild_id: string,
    startingBalance = 100
  ): Balance {
    const existing = this.GetBalance(user_id, guild_id);
    if (existing) {
      return existing;
    }

    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO balances (user_id, guild_id, balance, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(user_id, guild_id, startingBalance, created_at);

    const created = this.GetBalance(user_id, guild_id);
    if (!created) {
      throw new Error("Failed to create balance entry");
    }

    return created;
  }

  AdjustBalance(data: {
    user_id: string;
    guild_id: string;
    delta: number;
    minBalance?: number;
    startingBalance?: number;
  }): Balance {
    const transaction = this.db.transaction(() => {
      const current = this.EnsureBalance(
        data.user_id,
        data.guild_id,
        data.startingBalance ?? 100
      );
      const updated_at = Date.now();
      const nextBalance = Math.max(
        data.minBalance ?? 0,
        current.balance + data.delta
      );

      const stmt = this.db.prepare(
        `
        UPDATE balances
        SET balance = ?, updated_at = ?
        WHERE user_id = ? AND guild_id = ?
      `
      );

      stmt.run(nextBalance, updated_at, data.user_id, data.guild_id);

      const updated = this.GetBalance(data.user_id, data.guild_id);
      if (!updated) {
        throw new Error("Failed to update balance");
      }

      return updated;
    });

    return transaction();
  }

  GetInventory(user_id: string, guild_id: string): InventoryEntry[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, guild_id, item_id, quantity, updated_at
      FROM inventories
      WHERE user_id = ? AND guild_id = ?
    `
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
    item_id: string
  ): InventoryEntry | null {
    const stmt = this.db.prepare(
      `
      SELECT user_id, guild_id, item_id, quantity, updated_at
      FROM inventories
      WHERE user_id = ? AND guild_id = ? AND item_id = ?
    `
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
        data.item_id
      );
      const updated_at = Date.now();
      const nextQuantity = Math.max(
        0,
        Math.min(
          data.maxStack ?? Number.MAX_SAFE_INTEGER,
          (current?.quantity ?? 0) + data.delta
        )
      );

      if (nextQuantity === 0) {
        if (current) {
          this.db
            .prepare(
              "DELETE FROM inventories WHERE user_id = ? AND guild_id = ? AND item_id = ?"
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
        `
        )
        .run(
          data.user_id,
          data.guild_id,
          data.item_id,
          nextQuantity,
          updated_at
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

  SetMarketRotation(rotation: MarketRotation): void {
    this.db
      .prepare(
        `
        INSERT INTO market_rotations (guild_id, items, generated_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET items = excluded.items, generated_at = excluded.generated_at, expires_at = excluded.expires_at
      `
      )
      .run(
        rotation.guildId,
        JSON.stringify(rotation.items),
        rotation.generatedAt,
        rotation.expiresAt
      );
  }

  GetMarketRotation(guild_id: string): MarketRotation | null {
    const stmt = this.db.prepare(
      `
      SELECT guild_id, items, generated_at, expires_at
      FROM market_rotations
      WHERE guild_id = ?
    `
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

    return {
      guildId: row.guild_id,
      items: JSON.parse(row.items) as string[],
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
    };
  }

  ClaimDaily(options: {
    user_id: string;
    guild_id: string;
    reward: number;
    cooldownMs: number;
    startingBalance?: number;
  }):
    | { success: true; balance: Balance; nextAvailableAt: number }
    | { success: false; nextAvailableAt: number } {
    const transaction = this.db.transaction(() => {
      const now = Date.now();
      const claim = this.db
        .prepare(
          "SELECT last_claim_at FROM daily_claims WHERE user_id = ? AND guild_id = ?"
        )
        .get(options.user_id, options.guild_id) as
        | { last_claim_at: number }
        | undefined;

      if (claim) {
        const nextAvailableAt = claim.last_claim_at + options.cooldownMs;
        if (now < nextAvailableAt) {
          return { success: false as const, nextAvailableAt };
        }
      }

      const last_claim_at = now;
      this.db
        .prepare(
          `
          INSERT INTO daily_claims (user_id, guild_id, last_claim_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, guild_id) DO UPDATE SET last_claim_at = excluded.last_claim_at
        `
        )
        .run(options.user_id, options.guild_id, last_claim_at);

      const balance = this.AdjustBalance({
        user_id: options.user_id,
        guild_id: options.guild_id,
        delta: options.reward,
        startingBalance: options.startingBalance ?? 100,
      });

      return {
        success: true as const,
        balance,
        nextAvailableAt: last_claim_at + options.cooldownMs,
      };
    });

    return transaction();
  }

  Close(): void {
    this.db.close();
  }
}
