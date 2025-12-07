import { Logger } from "@shared/Logger";
import { UserDatabase } from "@database";
import { DAILY_COOLDOWN_MS, DAILY_REWARD, STARTING_BALANCE } from "./constants";
import { ITEM_MAP } from "./items";
import type { DailyClaimResult, InventoryEntry, MarketRotation } from "./types";

export class EconomyManager {
  private readonly userDb: UserDatabase;

  constructor(
    private readonly guildId: string,
    logger: Logger
  ) {
    this.userDb = new UserDatabase(logger);
  }

  EnsureBalance(userId: string): number {
    return this.userDb.EnsureBalance(userId, this.guildId, STARTING_BALANCE)
      .balance;
  }

  GetBalance(userId: string): number {
    const balance = this.userDb.GetBalance(userId, this.guildId);
    if (!balance) {
      return this.EnsureBalance(userId);
    }
    return balance.balance;
  }

  AdjustBalance(userId: string, delta: number, minBalance = 0): number {
    return this.userDb.AdjustBalance({
      user_id: userId,
      guild_id: this.guildId,
      delta,
      minBalance,
      startingBalance: STARTING_BALANCE,
    }).balance;
  }

  ClaimDaily(userId: string): DailyClaimResult {
    const result = this.userDb.ClaimDaily({
      user_id: userId,
      guild_id: this.guildId,
      reward: DAILY_REWARD,
      cooldownMs: DAILY_COOLDOWN_MS,
      startingBalance: STARTING_BALANCE,
    });

    if (!result.success) {
      return { success: false, nextAvailableAt: result.nextAvailableAt };
    }

    return {
      success: true,
      balance: result.balance.balance,
      nextAvailableAt: result.nextAvailableAt,
    };
  }

  GetInventory(userId: string): InventoryEntry[] {
    return this.userDb.GetInventory(userId, this.guildId);
  }

  AdjustInventoryItem(options: {
    userId: string;
    itemId: string;
    delta: number;
  }): InventoryEntry {
    const item = ITEM_MAP[options.itemId];
    return this.userDb.AdjustInventoryQuantity({
      user_id: options.userId,
      guild_id: this.guildId,
      item_id: options.itemId,
      delta: options.delta,
      maxStack: item?.maxStack,
    });
  }

  GetMarketRotation(): MarketRotation | null {
    return this.userDb.GetMarketRotation(this.guildId);
  }

  SetMarketRotation(rotation: MarketRotation): void {
    this.userDb.SetMarketRotation(rotation);
  }

  Close(): void {
    this.userDb.Close();
  }
}
