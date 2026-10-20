import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
import { TempActionStore } from "@database/Moderation/Stores/TempActionStore";
import { ModerationEventStore } from "@database/Moderation/Stores/ModerationEventStore";
import { AppealStore } from "@database/Moderation/Stores/AppealStore";
import { LockdownStore } from "@database/Moderation/Stores/LockdownStore";
import { LinkFilterStore } from "@database/Moderation/Stores/LinkFilterStore";
import { RaidModeStore } from "@database/Moderation/Stores/RaidModeStore";
import { RunMigrations } from "@database/Migrations";
import type { StoreMethods } from "@database/StoreDelegation";
import { DelegateStoreMethods } from "@database/StoreDelegation";
import { ModerationMigrations } from "@database/Migrations/moderation";

export type {
  Appeal,
  AppealActionType,
  AppealStatus,
  LinkFilter,
  LinkFilterType,
  Lockdown,
  LockdownScope,
  RaidMode,
  RaidModeChannelState,
  TempAction,
  TempActionType,
} from "@database/Moderation/Types";

// Store methods are exposed on the facade by DelegateStoreMethods; this merge gives them types.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ModerationDatabase
  extends
    StoreMethods<TempActionStore>,
    StoreMethods<ModerationEventStore>,
    StoreMethods<AppealStore>,
    StoreMethods<LockdownStore>,
    StoreMethods<LinkFilterStore>,
    StoreMethods<RaidModeStore> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ModerationDatabase {
  private readonly db: Database.Database;
  private readonly tempActions: TempActionStore;
  private readonly moderationEvents: ModerationEventStore;
  private readonly appeals: AppealStore;
  private readonly lockdowns: LockdownStore;
  private readonly linkFilters: LinkFilterStore;
  private readonly raidModes: RaidModeStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.tempActions = new TempActionStore(this.db);
    this.moderationEvents = new ModerationEventStore(this.db);
    this.appeals = new AppealStore(this.db);
    this.lockdowns = new LockdownStore(this.db);
    this.linkFilters = new LinkFilterStore(this.db);
    this.raidModes = new RaidModeStore(this.db);
    DelegateStoreMethods(this, [
      this.tempActions,
      this.moderationEvents,
      this.appeals,
      this.lockdowns,
      this.linkFilters,
      this.raidModes,
    ]);
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "moderation.db");

    try {
      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize moderation database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    try {
      RunMigrations(this.db, ModerationMigrations, this.logger);
    } catch (error) {
      this.logger.Error("Failed to create moderation tables", { error });
      throw error;
    }
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
