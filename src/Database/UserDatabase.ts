import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
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
import { ActivityCooldownStore } from "@database/User/Stores/ActivityCooldownStore";
import { RunMigrations } from "@database/Migrations";
import type { StoreMethods } from "@database/StoreDelegation";
import { DelegateStoreMethods } from "@database/StoreDelegation";
import { UserMigrations } from "@database/Migrations/user";

export type {
  Balance,
  Giveaway,
  GiveawayEntry,
  Note,
  UserXp,
  Warning,
} from "@database/User/Types";

// Store methods are exposed on the facade by DelegateStoreMethods; this merge gives them types.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface UserDatabase
  extends
    StoreMethods<NoteStore>,
    StoreMethods<WarningStore>,
    StoreMethods<BalanceStore>,
    StoreMethods<InventoryStore>,
    StoreMethods<MarketRotationStore>,
    StoreMethods<XpStore>,
    StoreMethods<GiveawayStore>,
    StoreMethods<ChatXpDailyStore>,
    StoreMethods<DuelStore>,
    StoreMethods<LotteryStore>,
    StoreMethods<ActivityCooldownStore> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
  private readonly activityCooldowns: ActivityCooldownStore;

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
    this.activityCooldowns = new ActivityCooldownStore(this.db);
    DelegateStoreMethods(this, [
      this.notes,
      this.warnings,
      this.balances,
      this.inventories,
      this.marketRotations,
      this.xp,
      this.giveaways,
      this.chatXpDaily,
      this.duels,
      this.lotteries,
      this.activityCooldowns,
    ]);
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
