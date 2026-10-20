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
import { ChatXpDailyStore } from "@database/User/Stores/ChatXpDailyStore";
import { DuelStore } from "@database/User/Stores/DuelStore";
import { LotteryStore } from "@database/User/Stores/LotteryStore";
import type { InventoryEntry, MarketRotation } from "@database/User/Types";
import { RunMigrations } from "@database/Migrations";
import { UserMigrations } from "@database/Migrations/user";

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
  private readonly chatXpDaily: ChatXpDailyStore;
  private readonly duels: DuelStore;
  private readonly lotteries: LotteryStore;

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
    this.chatXpDaily = new ChatXpDailyStore(this.db);
    this.duels = new DuelStore(this.db);
    this.lotteries = new LotteryStore(this.db);
  }

  public get Db(): Database.Database {
    return this.db;
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
    RunMigrations(this.db, UserMigrations, this.logger);
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

  GetChatXpDailyEarned(
    user_id: string,
    guild_id: string,
    day_key: number,
  ): number {
    return this.chatXpDaily.GetEarned(user_id, guild_id, day_key);
  }

  AddChatXpDailyEarned(
    user_id: string,
    guild_id: string,
    day_key: number,
    amount: number,
  ): number {
    return this.chatXpDaily.AddEarned(user_id, guild_id, day_key, amount);
  }

  CreateDuel(data: Parameters<DuelStore["CreateDuel"]>[0]) {
    return this.duels.CreateDuel(data);
  }

  GetDuelById(id: number) {
    return this.duels.GetDuelById(id);
  }

  GetDuelByMessageId(message_id: string) {
    return this.duels.GetDuelByMessageId(message_id);
  }

  ActivateDuel(id: number) {
    return this.duels.ActivateDuel(id);
  }

  CompleteDuel(id: number, winner_id: string | null) {
    return this.duels.CompleteDuel(id, winner_id);
  }

  CancelDuel(id: number) {
    return this.duels.CancelDuel(id);
  }

  ListPendingDuelsByChallenger(guild_id: string, challenger_id: string) {
    return this.duels.ListPendingByChallenger(guild_id, challenger_id);
  }

  CreateLottery(data: Parameters<LotteryStore["CreateLottery"]>[0]) {
    return this.lotteries.CreateLottery(data);
  }

  GetLotteryById(id: number) {
    return this.lotteries.GetLotteryById(id);
  }

  GetLotteryByMessageId(message_id: string) {
    return this.lotteries.GetLotteryByMessageId(message_id);
  }

  GetActiveLotteries(guild_id: string) {
    return this.lotteries.GetActiveLotteries(guild_id);
  }

  GetEndedLotteriesToProcess() {
    return this.lotteries.GetEndedLotteriesToProcess();
  }

  AddLotteryEntry(lottery_id: number, user_id: string, entry_cost: number) {
    return this.lotteries.AddEntry(lottery_id, user_id, entry_cost);
  }

  HasLotteryEntry(lottery_id: number, user_id: string) {
    return this.lotteries.HasEntry(lottery_id, user_id);
  }

  GetLotteryEntries(lottery_id: number) {
    return this.lotteries.GetEntries(lottery_id);
  }

  EndLottery(id: number, winner_id: string | null) {
    return this.lotteries.EndLottery(id, winner_id);
  }

  Ping(): boolean {
    const row = this.db.prepare("SELECT 1 AS ok").get() as
      | { ok: number }
      | undefined;
    return row?.ok === 1;
  }

  Close(): void {
    this.db.close();
  }
}
