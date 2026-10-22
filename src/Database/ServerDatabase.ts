import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import type { Logger } from "@shared/Logger";
import { EventStore } from "@database/Server/Stores/EventStore";
import { GuildSettingsStore } from "@database/Server/Stores/GuildSettingsStore";
import { GuildXpSettingsStore } from "@database/Server/Stores/GuildXpSettingsStore";
import { ReactionRoleStore } from "@database/Server/Stores/ReactionRoleStore";
import { StarboardStore } from "@database/Server/Stores/StarboardStore";
import { CommandCooldownStore } from "@database/Server/Stores/CommandCooldownStore";
import { LevelRoleRewardStore } from "@database/Server/Stores/LevelRoleRewardStore";
import { DisabledCommandStore } from "@database/Server/Stores/DisabledCommandStore";
import { CustomTagStore } from "@database/Server/Stores/CustomTagStore";
import { BlocklistStore } from "@database/Server/Stores/BlocklistStore";
import { CommandChannelStore } from "@database/Server/Stores/CommandChannelStore";
import { RunMigrations } from "@database/Migrations";
import type { StoreMethods } from "@database/StoreDelegation";
import { DelegateStoreMethods } from "@database/StoreDelegation";
import { ServerMigrations } from "@database/Migrations/server";

import type {
  BlocklistEntry,
  BlocklistTargetType,
  CustomTag,
  GuildSettings,
  GuildXpSettings,
  LevelRoleReward,
  ReactionRoleMapping,
  ReactionRolePanel,
  ScheduledEvent,
  StarboardEntry,
} from "@database/Server/Types";

export type {
  BlocklistEntry,
  BlocklistTargetType,
  CustomTag,
  GuildSettings,
  GuildXpSettings,
  LevelRoleReward,
  ReactionRoleMapping,
  ReactionRolePanel,
  ScheduledEvent,
  StarboardEntry,
};

// Store methods are exposed on the facade by DelegateStoreMethods; this merge gives them types.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ServerDatabase
  extends
    StoreMethods<EventStore>,
    StoreMethods<GuildSettingsStore>,
    StoreMethods<GuildXpSettingsStore>,
    StoreMethods<ReactionRoleStore>,
    StoreMethods<StarboardStore>,
    StoreMethods<CommandCooldownStore>,
    StoreMethods<LevelRoleRewardStore>,
    StoreMethods<DisabledCommandStore>,
    StoreMethods<CustomTagStore>,
    StoreMethods<BlocklistStore>,
    StoreMethods<CommandChannelStore> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ServerDatabase {
  private readonly db: Database.Database;
  private readonly events: EventStore;
  private readonly guildSettings: GuildSettingsStore;
  private readonly guildXpSettings: GuildXpSettingsStore;
  private readonly reactionRoles: ReactionRoleStore;
  private readonly starboard: StarboardStore;
  private readonly commandCooldowns: CommandCooldownStore;
  private readonly levelRoleRewards: LevelRoleRewardStore;
  private readonly disabledCommands: DisabledCommandStore;
  private readonly customTags: CustomTagStore;
  private readonly blocklist: BlocklistStore;
  private readonly commandChannels: CommandChannelStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.events = new EventStore(this.db);
    this.guildSettings = new GuildSettingsStore(this.db, this.logger);
    this.guildXpSettings = new GuildXpSettingsStore(this.db);
    this.reactionRoles = new ReactionRoleStore(this.db);
    this.starboard = new StarboardStore(this.db);
    this.commandCooldowns = new CommandCooldownStore(this.db);
    this.levelRoleRewards = new LevelRoleRewardStore(this.db);
    this.disabledCommands = new DisabledCommandStore(this.db);
    this.customTags = new CustomTagStore(this.db);
    this.blocklist = new BlocklistStore(this.db);
    this.commandChannels = new CommandChannelStore(this.db);
    DelegateStoreMethods(this, [
      this.events,
      this.guildSettings,
      this.guildXpSettings,
      this.reactionRoles,
      this.starboard,
      this.commandCooldowns,
      this.levelRoleRewards,
      this.disabledCommands,
      this.customTags,
      this.blocklist,
      this.commandChannels,
    ]);
  }

  private InitializeDatabase(): Database.Database {
    const dataDir = ResolveDataDir();
    const dbPath = join(dataDir, "server.db");

    try {
      return new Database(dbPath);
    } catch (error) {
      this.logger.Error("Failed to initialize server database", { error });
      throw error;
    }
  }

  private CreateTables(): void {
    try {
      RunMigrations(this.db, ServerMigrations, this.logger);
    } catch (error) {
      this.logger.Error("Failed to create server tables", { error });
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
