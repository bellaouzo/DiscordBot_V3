import Database from "better-sqlite3";
import { join } from "path";
import { ResolveDataDir } from "@config/DataConfig";
import { Logger } from "@shared/Logger";
import { EventStore } from "@database/Server/Stores/EventStore";
import { GuildSettingsStore } from "@database/Server/Stores/GuildSettingsStore";
import { CommandCooldownStore } from "@database/Server/Stores/CommandCooldownStore";

export type { GuildSettings, ScheduledEvent } from "@database/Server/Types";

export class ServerDatabase {
  private readonly db: Database.Database;
  private readonly events: EventStore;
  private readonly guildSettings: GuildSettingsStore;
  private readonly commandCooldowns: CommandCooldownStore;

  constructor(private readonly logger: Logger) {
    this.db = this.InitializeDatabase();
    this.CreateTables();
    this.events = new EventStore(this.db);
    this.guildSettings = new GuildSettingsStore(this.db, this.logger);
    this.commandCooldowns = new CommandCooldownStore(this.db);
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

  private static readonly VALID_GUILD_SETTINGS_COLUMNS = new Map<
    string,
    "TEXT" | "INTEGER"
  >([
    ["appeal_review_category_id", "TEXT"],
    ["ticket_log_channel_id", "TEXT"],
    ["delete_log_channel_id", "TEXT"],
    ["production_log_channel_id", "TEXT"],
    ["welcome_channel_id", "TEXT"],
    ["roblox_linked_discord_user_id", "TEXT"],
    ["roblox_linked_at", "INTEGER"],
  ]);

  private CreateTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          guild_event_id INTEGER,
          title TEXT NOT NULL,
          scheduled_at INTEGER NOT NULL,
          should_notify INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_guild_time ON events(guild_id, scheduled_at);

        CREATE TABLE IF NOT EXISTS guild_settings (
          guild_id TEXT PRIMARY KEY,
          admin_role_ids TEXT NOT NULL,
          mod_role_ids TEXT NOT NULL,
          ticket_category_id TEXT,
          command_log_channel_id TEXT,
          announcement_channel_id TEXT,
          delete_log_channel_id TEXT,
          production_log_channel_id TEXT,
          welcome_channel_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_guild_settings_updated ON guild_settings(updated_at);

        CREATE TABLE IF NOT EXISTS command_cooldowns (
          user_id TEXT NOT NULL,
          command_name TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, command_name)
        );

        CREATE INDEX IF NOT EXISTS idx_command_cooldowns_expires ON command_cooldowns(expires_at);
      `);

      this.EnsureGuildSettingsColumns();
      this.EnsureGuildEventIdColumn();
    } catch (error) {
      this.logger.Error("Failed to create server tables", { error });
      throw error;
    }
  }

  private EnsureGuildSettingsColumns(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(guild_settings)")
      .all() as Array<{ name: string }>;

    const ensureColumn = (name: string): void => {
      const columnType = ServerDatabase.VALID_GUILD_SETTINGS_COLUMNS.get(name);
      if (!columnType) {
        throw new Error(`Invalid column name for guild_settings: ${name}`);
      }
      const has = columns.some((c) => c.name === name);
      if (!has) {
        this.db
          .prepare(
            `ALTER TABLE guild_settings ADD COLUMN ${name} ${columnType}`,
          )
          .run();
      }
    };

    for (const columnName of ServerDatabase.VALID_GUILD_SETTINGS_COLUMNS.keys()) {
      ensureColumn(columnName);
    }
  }

  private EnsureGuildEventIdColumn(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(events)")
      .all() as Array<{ name: string }>;
    const hasColumn = columns.some(
      (column) => column.name === "guild_event_id",
    );

    if (hasColumn) {
      return;
    }

    const addColumn = this.db.prepare(
      "ALTER TABLE events ADD COLUMN guild_event_id INTEGER",
    );
    addColumn.run();

    this.BackfillGuildEventIds();
  }

  private BackfillGuildEventIds(): void {
    const guilds = this.db
      .prepare("SELECT DISTINCT guild_id FROM events")
      .all() as Array<{ guild_id: string }>;

    const selectEvents = this.db.prepare(
      "SELECT id FROM events WHERE guild_id = ? ORDER BY scheduled_at ASC, id ASC",
    );
    const updateEvent = this.db.prepare(
      "UPDATE events SET guild_event_id = ? WHERE id = ?",
    );

    const transaction = this.db.transaction(() => {
      guilds.forEach((guild) => {
        const events = selectEvents.all(guild.guild_id) as Array<{
          id: number;
        }>;
        events.forEach((event, index) => {
          updateEvent.run(index + 1, event.id);
        });
      });
    });

    transaction();
  }

  CreateEvent(data: {
    guild_id: string;
    title: string;
    scheduled_at: number;
    should_notify: boolean;
    created_by: string;
  }) {
    return this.events.CreateEvent(data);
  }

  ListUpcomingEvents(guild_id: string, after?: number) {
    return this.events.ListUpcomingEvents(guild_id, after);
  }

  GetEventById(guild_event_id: number, guild_id: string) {
    return this.events.GetEventById(guild_event_id, guild_id);
  }

  DeleteEvent(guild_event_id: number, guild_id: string) {
    return this.events.DeleteEvent(guild_event_id, guild_id);
  }

  GetGuildSettings(guild_id: string) {
    return this.guildSettings.GetGuildSettings(guild_id);
  }

  GetCommandCooldownExpiry(userId: string, commandName: string): number | undefined {
    return this.commandCooldowns.GetExpiry(userId, commandName);
  }

  SetCommandCooldownExpiry(
    userId: string,
    commandName: string,
    expiresAt: number,
  ): void {
    this.commandCooldowns.SetExpiry(userId, commandName, expiresAt);
  }

  PruneExpiredCommandCooldowns(now: number): void {
    this.commandCooldowns.PruneExpired(now);
  }

  UpsertGuildSettings(settings: {
    guild_id: string;
    admin_role_ids?: string[];
    mod_role_ids?: string[];
    ticket_category_id?: string | null;
    appeal_review_category_id?: string | null;
    command_log_channel_id?: string | null;
    ticket_log_channel_id?: string | null;
    announcement_channel_id?: string | null;
    delete_log_channel_id?: string | null;
    production_log_channel_id?: string | null;
    welcome_channel_id?: string | null;
    roblox_linked_discord_user_id?: string | null;
    roblox_linked_at?: number | null;
  }) {
    return this.guildSettings.UpsertGuildSettings(settings);
  }

  Close(): void {
    this.db.close();
  }
}
