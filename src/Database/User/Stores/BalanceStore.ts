import Database from "better-sqlite3";
import { MapBalance } from "@database/User/Mappers";
import { Balance } from "@database/User/Types";

export class BalanceStore {
  constructor(private readonly db: Database.Database) {}

  GetBalance(user_id: string, guild_id: string): Balance | null {
    const stmt = this.db.prepare(
      "SELECT * FROM balances WHERE user_id = ? AND guild_id = ?",
    );
    const row = stmt.get(user_id, guild_id) as
      | Record<string, unknown>
      | undefined;
    return row ? MapBalance(row) : null;
  }

  EnsureBalance(
    user_id: string,
    guild_id: string,
    startingBalance = 100,
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
        data.startingBalance ?? 100,
      );
      const updated_at = Date.now();
      const nextBalance = Math.max(
        data.minBalance ?? 0,
        current.balance + data.delta,
      );

      const stmt = this.db.prepare(
        `
        UPDATE balances
        SET balance = ?, updated_at = ?
        WHERE user_id = ? AND guild_id = ?
      `,
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
    limit = 10,
  ): { userId: string; balance: number; updatedAt: number }[] {
    const stmt = this.db.prepare(
      `
      SELECT user_id, balance, updated_at
      FROM balances
      WHERE guild_id = ?
      ORDER BY balance DESC, updated_at ASC
      LIMIT ?
    `,
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
        options.startingBalance ?? 100,
      );
      const toBalance = this.EnsureBalance(
        options.to_user_id,
        options.guild_id,
        options.startingBalance ?? 100,
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
      `,
      );

      updateStmt.run(
        fromBalance.balance - options.amount,
        updated_at,
        options.from_user_id,
        options.guild_id,
      );
      updateStmt.run(
        toBalance.balance + options.amount,
        updated_at,
        options.to_user_id,
        options.guild_id,
      );

      const updatedFrom = this.GetBalance(
        options.from_user_id,
        options.guild_id,
      );
      const updatedTo = this.GetBalance(options.to_user_id, options.guild_id);

      if (!updatedFrom || !updatedTo) {
        throw new Error("Failed to update balances");
      }

      return { success: true as const, from: updatedFrom, to: updatedTo };
    });

    return transaction();
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
          "SELECT last_claim_at FROM daily_claims WHERE user_id = ? AND guild_id = ?",
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
        `,
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
}
