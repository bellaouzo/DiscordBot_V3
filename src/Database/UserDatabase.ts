import Database from "better-sqlite3";
import * as fs from "fs";
import { Logger } from "@shared/Logger";
import type { InventoryEntry, MarketRotation } from "@systems/Economy/types";
import { join } from "path";
import { SafeParseJson, isStringArray } from "@utilities/SafeJson";

export interface Warning {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  reason: string | null;
  created_at: number;
}

export interface Note {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  content: string;
  created_at: number;
}

export interface Balance {
  user_id: string;
  guild_id: string;
  balance: number;
  updated_at: number;
}

export interface UserXp {
  user_id: string;
  guild_id: string;
  xp: number;
  level: number;
  total_xp_earned: number;
  updated_at: number;
}

export interface Giveaway {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  prize: string;
  winner_count: number;
  ends_at: number;
  ended: boolean;
  winners: string[] | null;
  created_at: number;
}

export interface GiveawayEntry {
  giveaway_id: number;
  user_id: string;
  entered_at: number;
}

export class UserDatabase {
  private db: Database.Database;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
  }

  private MapNote(row: Record<string, unknown>): Note {
    return {
      id: Number(row.id),
      user_id: String(row.user_id),
      guild_id: String(row.guild_id),
      moderator_id: String(row.moderator_id),
      content: String(row.content),
      created_at: Number(row.created_at),
    };
  }

  private MapWarning(row: Record<string, unknown>): Warning {
    return {
      id: Number(row.id),
      user_id: String(row.user_id),
      guild_id: String(row.guild_id),
      moderator_id: String(row.moderator_id),
      reason: row.reason ? String(row.reason) : null,
      created_at: Number(row.created_at),
    };
  }

  private MapBalance(row: Record<string, unknown>): Balance {
    return {
      user_id: String(row.user_id),
      guild_id: String(row.guild_id),
      balance: Number(row.balance),
      updated_at: Number(row.updated_at),
    };
  }

  private MapUserXp(row: Record<string, unknown>): UserXp {
    return {
      user_id: String(row.user_id),
      guild_id: String(row.guild_id),
      xp: Number(row.xp),
      level: Number(row.level),
      total_xp_earned: Number(row.total_xp_earned),
      updated_at: Number(row.updated_at),
    };
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

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_guild ON notes(user_id, guild_id);
      CREATE INDEX IF NOT EXISTS idx_notes_guild ON notes(guild_id);

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

      CREATE TABLE IF NOT EXISTS user_xp (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        total_xp_earned INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id);
      CREATE INDEX IF NOT EXISTS idx_user_xp_level ON user_xp(guild_id, level DESC, xp DESC);

      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        host_id TEXT NOT NULL,
        prize TEXT NOT NULL,
        winner_count INTEGER NOT NULL DEFAULT 1,
        ends_at INTEGER NOT NULL,
        ended INTEGER NOT NULL DEFAULT 0,
        winners TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);
      CREATE INDEX IF NOT EXISTS idx_giveaways_ends_at ON giveaways(ended, ends_at);

      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        entered_at INTEGER NOT NULL,
        PRIMARY KEY (giveaway_id, user_id),
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
      );
    `);
  }

  AddNote(data: {
    user_id: string;
    guild_id: string;
    moderator_id: string;
    content: string;
  }): Note {
    const created_at = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO notes (user_id, guild_id, moderator_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = stmt.run(
      data.user_id,
      data.guild_id,
      data.moderator_id,
      data.content,
      created_at
    ).lastInsertRowid as number;

    const note = this.GetNoteById(id, data.guild_id);
    if (!note) {
      throw new Error("Failed to create note");
    }

    return note;
  }

  GetNotes(user_id: string, guild_id: string, limit?: number): Note[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notes
      WHERE user_id = ? AND guild_id = ?
      ORDER BY created_at ASC
      ${limit ? "LIMIT ?" : ""}
    `);

    const rows = limit
      ? (stmt.all(user_id, guild_id, limit) as Record<string, unknown>[])
      : (stmt.all(user_id, guild_id) as Record<string, unknown>[]);

    return rows.map((row) => this.MapNote(row));
  }

  GetNoteById(id: number, guild_id: string): Note | null {
    const stmt = this.db.prepare(
      "SELECT * FROM notes WHERE id = ? AND guild_id = ?"
    );
    const row = stmt.get(id, guild_id) as Record<string, unknown> | undefined;
    return row ? this.MapNote(row) : null;
  }

  RemoveNoteById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM notes WHERE id = ? AND guild_id = ?"
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestNote(user_id: string, guild_id: string): Note | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM notes
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(user_id, guild_id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const note = this.MapNote(row);
    const removed = this.RemoveNoteById(note.id, guild_id);
    return removed ? note : null;
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

    const rows = limit
      ? (stmt.all(user_id, guild_id, limit) as Record<string, unknown>[])
      : (stmt.all(user_id, guild_id) as Record<string, unknown>[]);

    return rows.map((row) => this.MapWarning(row));
  }

  GetWarningById(id: number, guild_id: string): Warning | null {
    const stmt = this.db.prepare(
      "SELECT * FROM warnings WHERE id = ? AND guild_id = ?"
    );
    const row = stmt.get(id, guild_id) as Record<string, unknown> | undefined;
    return row ? this.MapWarning(row) : null;
  }

  RemoveWarningById(id: number, guild_id: string): boolean {
    const stmt = this.db.prepare(
      "DELETE FROM warnings WHERE id = ? AND guild_id = ?"
    );
    const result = stmt.run(id, guild_id);
    return result.changes > 0;
  }

  RemoveLatestWarning(user_id: string, guild_id: string): Warning | null {
    const row = this.db
      .prepare(
        `
        SELECT * FROM warnings
        WHERE user_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(user_id, guild_id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const warning = this.MapWarning(row);
    const removed = this.RemoveWarningById(warning.id, guild_id);
    return removed ? warning : null;
  }

  GetBalance(user_id: string, guild_id: string): Balance | null {
    const stmt = this.db.prepare(
      "SELECT * FROM balances WHERE user_id = ? AND guild_id = ?"
    );
    const row = stmt.get(user_id, guild_id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.MapBalance(row) : null;
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

  GetTopBalances(
    guild_id: string,
    limit = 10
  ): { userId: string; balance: number; updatedAt: number }[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, balance, updated_at
      FROM balances
      WHERE guild_id = ?
      ORDER BY balance DESC, updated_at ASC
      LIMIT ?
    `
    );

    const rows = stmt.all(guild_id, limit) as {
      user_id: string;
      balance: number;
      updated_at: number;
    }[];

    return rows.map((row) => ({
      userId: row.user_id,
      balance: row.balance,
      updatedAt: row.updated_at,
    }));
  }

  TransferBalance(options: {
    from_user_id: string;
    to_user_id: string;
    guild_id: string;
    amount: number;
    minBalance?: number;
    startingBalance?: number;
  }):
    | {
        success: true;
        from: Balance;
        to: Balance;
      }
    | {
        success: false;
        reason: "insufficient";
      } {
    if (options.amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }

    const transaction = this.db.transaction(() => {
      const fromBalance = this.EnsureBalance(
        options.from_user_id,
        options.guild_id,
        options.startingBalance ?? 100
      );
      const toBalance = this.EnsureBalance(
        options.to_user_id,
        options.guild_id,
        options.startingBalance ?? 100
      );

      const minBalance = options.minBalance ?? 0;
      if (fromBalance.balance - options.amount < minBalance) {
        return { success: false as const, reason: "insufficient" as const };
      }

      const updated_at = Date.now();
      const updateStmt = this.db.prepare(
        `
        UPDATE balances
        SET balance = ?, updated_at = ?
        WHERE user_id = ? AND guild_id = ?
      `
      );

      updateStmt.run(
        fromBalance.balance - options.amount,
        updated_at,
        options.from_user_id,
        options.guild_id
      );
      updateStmt.run(
        toBalance.balance + options.amount,
        updated_at,
        options.to_user_id,
        options.guild_id
      );

      const updatedFrom = this.GetBalance(
        options.from_user_id,
        options.guild_id
      );
      const updatedTo = this.GetBalance(options.to_user_id, options.guild_id);

      if (!updatedFrom || !updatedTo) {
        throw new Error("Failed to update balances");
      }

      return { success: true as const, from: updatedFrom, to: updatedTo };
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

    const itemsResult = SafeParseJson(row.items, isStringArray);
    return {
      guildId: row.guild_id,
      items: itemsResult.success && itemsResult.data ? itemsResult.data : [],
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

  // ================== XP & Leveling Methods ==================

  private CalculateXpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  GetUserXp(user_id: string, guild_id: string): UserXp | null {
    const stmt = this.db.prepare(
      "SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?"
    );
    const row = stmt.get(user_id, guild_id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.MapUserXp(row) : null;
  }

  EnsureUserXp(user_id: string, guild_id: string): UserXp {
    const existing = this.GetUserXp(user_id, guild_id);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    this.db
      .prepare(
        `
        INSERT INTO user_xp (user_id, guild_id, xp, level, total_xp_earned, updated_at)
        VALUES (?, ?, 0, 1, 0, ?)
      `
      )
      .run(user_id, guild_id, now);

    return this.GetUserXp(user_id, guild_id)!;
  }

  AddXp(data: { user_id: string; guild_id: string; amount: number }): {
    userXp: UserXp;
    leveledUp: boolean;
    previousLevel: number;
  } {
    const transaction = this.db.transaction(() => {
      const current = this.EnsureUserXp(data.user_id, data.guild_id);
      const previousLevel = current.level;
      let xp = current.xp + data.amount;
      let level = current.level;
      let leveledUp = false;

      // Check for level ups
      let xpNeeded = this.CalculateXpForLevel(level);
      while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        leveledUp = true;
        xpNeeded = this.CalculateXpForLevel(level);
      }

      const now = Date.now();
      this.db
        .prepare(
          `
          UPDATE user_xp
          SET xp = ?, level = ?, total_xp_earned = total_xp_earned + ?, updated_at = ?
          WHERE user_id = ? AND guild_id = ?
        `
        )
        .run(xp, level, data.amount, now, data.user_id, data.guild_id);

      const updated = this.GetUserXp(data.user_id, data.guild_id)!;
      return { userXp: updated, leveledUp, previousLevel };
    });

    return transaction();
  }

  GetXpLeaderboard(
    guild_id: string,
    limit = 10
  ): { userId: string; xp: number; level: number; totalXpEarned: number }[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, xp, level, total_xp_earned
      FROM user_xp
      WHERE guild_id = ?
      ORDER BY level DESC, xp DESC
      LIMIT ?
    `
    );

    const rows = stmt.all(guild_id, limit) as {
      user_id: string;
      xp: number;
      level: number;
      total_xp_earned: number;
    }[];

    return rows.map((row) => ({
      userId: row.user_id,
      xp: row.xp,
      level: row.level,
      totalXpEarned: row.total_xp_earned,
    }));
  }

  GetXpForNextLevel(level: number): number {
    return this.CalculateXpForLevel(level);
  }

  // ================== Giveaway Methods ==================

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
      now
    );

    return this.GetGiveawayByMessageId(data.message_id)!;
  }

  private ParseWinners(winners: string | null): string[] | null {
    if (!winners) return null;
    const result = SafeParseJson(winners, isStringArray);
    return result.success && result.data ? result.data : null;
  }

  GetGiveawayByMessageId(message_id: string): Giveaway | null {
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE message_id = ?"
    );
    const row = stmt.get(message_id) as
      | {
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
        }
      | undefined;

    if (!row) return null;

    return {
      ...row,
      ended: row.ended === 1,
      winners: this.ParseWinners(row.winners),
    };
  }

  GetActiveGiveaways(guild_id: string): Giveaway[] {
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC"
    );
    const rows = stmt.all(guild_id) as Array<{
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
    }>;

    return rows.map((row) => ({
      ...row,
      ended: row.ended === 1,
      winners: this.ParseWinners(row.winners),
    }));
  }

  GetEndedGiveawaysToProcess(): Giveaway[] {
    const now = Date.now();
    const stmt = this.db.prepare(
      "SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?"
    );
    const rows = stmt.all(now) as Array<{
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
    }>;

    return rows.map((row) => ({
      ...row,
      ended: row.ended === 1,
      winners: this.ParseWinners(row.winners),
    }));
  }

  AddGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    const now = Date.now();
    try {
      this.db
        .prepare(
          `
          INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at)
          VALUES (?, ?, ?)
        `
        )
        .run(giveaway_id, user_id, now);
      return true;
    } catch {
      // Entry already exists
      return false;
    }
  }

  RemoveGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?"
      )
      .run(giveaway_id, user_id);
    return result.changes > 0;
  }

  HasEnteredGiveaway(giveaway_id: number, user_id: string): boolean {
    const stmt = this.db.prepare(
      "SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?"
    );
    return stmt.get(giveaway_id, user_id) !== undefined;
  }

  GetGiveawayEntries(giveaway_id: number): string[] {
    const stmt = this.db.prepare(
      "SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?"
    );
    const rows = stmt.all(giveaway_id) as { user_id: string }[];
    return rows.map((r) => r.user_id);
  }

  GetGiveawayEntryCount(giveaway_id: number): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?"
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
      `
      )
      .run(JSON.stringify(winnerIds), message_id);
    return result.changes > 0;
  }

  Close(): void {
    this.db.close();
  }
}
