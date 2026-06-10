import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
import type {
  Balance,
  Giveaway,
  Note,
  UserXp,
  Warning,
} from "@database/User/Types";
import { NoteStore } from "@database/User/Stores/NoteStore";
import { WarningStore } from "@database/User/Stores/WarningStore";
import { BalanceStore } from "@database/User/Stores/BalanceStore";
import { InventoryStore } from "@database/User/Stores/InventoryStore";
import { MarketRotationStore } from "@database/User/Stores/MarketRotationStore";
import { XpStore } from "@database/User/Stores/XpStore";
import { GiveawayStore } from "@database/User/Stores/GiveawayStore";
import type { InventoryEntry, MarketRotation } from "@systems/Economy/types";

export type {
  Balance,
  Giveaway,
  GiveawayEntry,
  Note,
  UserXp,
  Warning,
} from "@database/User/Types";

export class UserDatabase {
  private readonly db: Database.Database;
  private readonly notes: NoteStore;
  private readonly warnings: WarningStore;
  private readonly balances: BalanceStore;
  private readonly inventories: InventoryStore;
  private readonly marketRotations: MarketRotationStore;
  private readonly xp: XpStore;
  private readonly giveaways: GiveawayStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.notes = new NoteStore(this.db);
    this.warnings = new WarningStore(this.db);
    this.balances = new BalanceStore(this.db);
    this.inventories = new InventoryStore(this.db);
    this.marketRotations = new MarketRotationStore(this.db);
    this.xp = new XpStore(this.db);
    this.giveaways = new GiveawayStore(this.db);
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "users.db");

    try {
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
    return this.notes.AddNote(data);
  }

  GetNotes(user_id: string, guild_id: string, limit?: number): Note[] {
    return this.notes.GetNotes(user_id, guild_id, limit);
  }

  GetNoteById(id: number, guild_id: string): Note | null {
    return this.notes.GetNoteById(id, guild_id);
  }

  RemoveNoteById(id: number, guild_id: string): boolean {
    return this.notes.RemoveNoteById(id, guild_id);
  }

  RemoveLatestNote(user_id: string, guild_id: string): Note | null {
    return this.notes.RemoveLatestNote(user_id, guild_id);
  }

  AddWarning(data: {
    user_id: string;
    guild_id: string;
    moderator_id: string;
    reason?: string | null;
  }): Warning {
    return this.warnings.AddWarning(data);
  }

  GetWarnings(user_id: string, guild_id: string, limit?: number): Warning[] {
    return this.warnings.GetWarnings(user_id, guild_id, limit);
  }

  GetWarningById(id: number, guild_id: string): Warning | null {
    return this.warnings.GetWarningById(id, guild_id);
  }

  RemoveWarningById(id: number, guild_id: string): boolean {
    return this.warnings.RemoveWarningById(id, guild_id);
  }

  RemoveLatestWarning(user_id: string, guild_id: string): Warning | null {
    return this.warnings.RemoveLatestWarning(user_id, guild_id);
  }

  GetBalance(user_id: string, guild_id: string): Balance | null {
    return this.balances.GetBalance(user_id, guild_id);
  }

  EnsureBalance(
    user_id: string,
    guild_id: string,
    startingBalance = 100,
  ): Balance {
    return this.balances.EnsureBalance(user_id, guild_id, startingBalance);
  }

  AdjustBalance(data: {
    user_id: string;
    guild_id: string;
    delta: number;
    minBalance?: number;
    startingBalance?: number;
  }): Balance {
    return this.balances.AdjustBalance(data);
  }

  GetTopBalances(
    guild_id: string,
    limit = 10,
  ): { userId: string; balance: number; updatedAt: number }[] {
    return this.balances.GetTopBalances(guild_id, limit);
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
    return this.balances.TransferBalance(options);
  }

  GetInventory(user_id: string, guild_id: string): InventoryEntry[] {
    return this.inventories.GetInventory(user_id, guild_id);
  }

  GetInventoryItem(
    user_id: string,
    guild_id: string,
    item_id: string,
  ): InventoryEntry | null {
    return this.inventories.GetInventoryItem(user_id, guild_id, item_id);
  }

  AdjustInventoryQuantity(data: {
    user_id: string;
    guild_id: string;
    item_id: string;
    delta: number;
    maxStack?: number;
  }): InventoryEntry {
    return this.inventories.AdjustInventoryQuantity(data);
  }

  SetMarketRotation(rotation: MarketRotation): void {
    this.marketRotations.SetMarketRotation(rotation);
  }

  GetMarketRotation(guild_id: string): MarketRotation | null {
    return this.marketRotations.GetMarketRotation(guild_id);
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
    return this.balances.ClaimDaily(options);
  }

  GetUserXp(user_id: string, guild_id: string): UserXp | null {
    return this.xp.GetUserXp(user_id, guild_id);
  }

  EnsureUserXp(user_id: string, guild_id: string): UserXp {
    return this.xp.EnsureUserXp(user_id, guild_id);
  }

  AddXp(data: { user_id: string; guild_id: string; amount: number }): {
    userXp: UserXp;
    leveledUp: boolean;
    previousLevel: number;
  } {
    return this.xp.AddXp(data);
  }

  GetXpLeaderboard(
    guild_id: string,
    limit = 10,
  ): { userId: string; xp: number; level: number; totalXpEarned: number }[] {
    return this.xp.GetXpLeaderboard(guild_id, limit);
  }

  GetXpForNextLevel(level: number): number {
    return this.xp.GetXpForNextLevel(level);
  }

  CreateGiveaway(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    host_id: string;
    prize: string;
    winner_count: number;
    ends_at: number;
  }): Giveaway {
    return this.giveaways.CreateGiveaway(data);
  }

  GetGiveawayByMessageId(message_id: string): Giveaway | null {
    return this.giveaways.GetGiveawayByMessageId(message_id);
  }

  GetActiveGiveaways(guild_id: string): Giveaway[] {
    return this.giveaways.GetActiveGiveaways(guild_id);
  }

  GetEndedGiveawaysToProcess(): Giveaway[] {
    return this.giveaways.GetEndedGiveawaysToProcess();
  }

  AddGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    return this.giveaways.AddGiveawayEntry(giveaway_id, user_id);
  }

  RemoveGiveawayEntry(giveaway_id: number, user_id: string): boolean {
    return this.giveaways.RemoveGiveawayEntry(giveaway_id, user_id);
  }

  HasEnteredGiveaway(giveaway_id: number, user_id: string): boolean {
    return this.giveaways.HasEnteredGiveaway(giveaway_id, user_id);
  }

  GetGiveawayEntries(giveaway_id: number): string[] {
    return this.giveaways.GetGiveawayEntries(giveaway_id);
  }

  GetGiveawayEntryCount(giveaway_id: number): number {
    return this.giveaways.GetGiveawayEntryCount(giveaway_id);
  }

  EndGiveaway(message_id: string, winnerIds: string[]): boolean {
    return this.giveaways.EndGiveaway(message_id, winnerIds);
  }

  Close(): void {
    this.db.close();
  }
}
