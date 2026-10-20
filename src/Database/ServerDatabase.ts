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
import { RunMigrations } from "@database/Migrations";
import { ServerMigrations } from "@database/Migrations/server";

import type {
  GuildSettings,
  GuildXpSettings,
  LevelRoleReward,
  ReactionRoleMapping,
  ReactionRolePanel,
  ScheduledEvent,
  StarboardEntry,
} from "@database/Server/Types";

export type {
  GuildSettings,
  GuildXpSettings,
  LevelRoleReward,
  ReactionRoleMapping,
  ReactionRolePanel,
  ScheduledEvent,
  StarboardEntry,
};

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

  ListEventsDueForNotification(now: number) {
    return this.events.ListEventsDueForNotification(now);
  }

  MarkEventNotified(id: number, notifiedAt: number) {
    return this.events.MarkEventNotified(id, notifiedAt);
  }

  GetGuildSettings(guild_id: string) {
    return this.guildSettings.GetGuildSettings(guild_id);
  }

  GetCommandCooldownExpiry(
    userId: string,
    commandName: string,
  ): number | undefined {
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

  GetGuildXpSettings(guild_id: string) {
    return this.guildXpSettings.GetGuildXpSettings(guild_id);
  }

  UpsertGuildXpSettings(
    settings: Partial<
      Omit<import("@database/Server/Types").GuildXpSettings, "guild_id">
    > & { guild_id: string },
  ) {
    return this.guildXpSettings.UpsertGuildXpSettings(settings);
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
    autorole_id?: string | null;
    starboard_channel_id?: string | null;
    starboard_emoji?: string | null;
    starboard_threshold?: number | null;
    roblox_linked_discord_user_id?: string | null;
    roblox_linked_at?: number | null;
    verification_enabled?: boolean;
    unverified_role_id?: string | null;
    verified_role_id?: string | null;
    verification_min_account_age_days?: number;
    verification_channel_id?: string | null;
    economy_enabled?: boolean;
    giveaways_enabled?: boolean;
  }) {
    return this.guildSettings.UpsertGuildSettings(settings);
  }

  GetLevelRoleRewards(guild_id: string): LevelRoleReward[] {
    return this.levelRoleRewards.GetLevelRoleRewards(guild_id);
  }

  GetLevelRoleReward(guild_id: string, level: number): LevelRoleReward | null {
    return this.levelRoleRewards.GetLevelRoleReward(guild_id, level);
  }

  UpsertLevelRoleReward(data: {
    guild_id: string;
    level: number;
    role_id: string;
  }): LevelRoleReward {
    return this.levelRoleRewards.UpsertLevelRoleReward(data);
  }

  RemoveLevelRoleReward(guild_id: string, level: number): boolean {
    return this.levelRoleRewards.RemoveLevelRoleReward(guild_id, level);
  }

  IsCommandDisabled(guild_id: string, command_name: string): boolean {
    return this.disabledCommands.IsCommandDisabled(guild_id, command_name);
  }

  DisableCommand(guild_id: string, command_name: string): void {
    this.disabledCommands.DisableCommand(guild_id, command_name);
  }

  EnableCommand(guild_id: string, command_name: string): boolean {
    return this.disabledCommands.EnableCommand(guild_id, command_name);
  }

  ListDisabledCommands(guild_id: string): string[] {
    return this.disabledCommands.ListDisabledCommands(guild_id);
  }

  Ping(): boolean {
    const row = this.db.prepare("SELECT 1 AS ok").get() as
      | { ok: number }
      | undefined;
    return row?.ok === 1;
  }

  CreateReactionRolePanel(data: {
    guild_id: string;
    channel_id: string;
    message_id: string;
    created_by: string;
  }): ReactionRolePanel {
    return this.reactionRoles.CreatePanel(data);
  }

  GetReactionRolePanelById(
    guild_id: string,
    panel_id: number,
  ): ReactionRolePanel | null {
    return this.reactionRoles.GetPanelById(guild_id, panel_id);
  }

  GetReactionRolePanelByMessage(
    guild_id: string,
    message_id: string,
  ): ReactionRolePanel | null {
    return this.reactionRoles.GetPanelByMessage(guild_id, message_id);
  }

  ListReactionRolePanels(guild_id: string): ReactionRolePanel[] {
    return this.reactionRoles.ListPanels(guild_id);
  }

  ListReactionRolePanelsByChannel(
    guild_id: string,
    channel_id: string,
  ): ReactionRolePanel[] {
    return this.reactionRoles.ListPanelsByChannel(guild_id, channel_id);
  }

  DeleteReactionRolePanel(panel_id: number): boolean {
    return this.reactionRoles.DeletePanel(panel_id);
  }

  AddReactionRoleMapping(data: {
    panel_id: number;
    emoji: string;
    role_id: string;
  }): ReactionRoleMapping {
    return this.reactionRoles.AddMapping(data);
  }

  RemoveReactionRoleMapping(id: number): boolean {
    return this.reactionRoles.RemoveMapping(id);
  }

  GetReactionRoleMappingByPanelAndEmoji(
    panel_id: number,
    emoji: string,
  ): ReactionRoleMapping | null {
    return this.reactionRoles.GetMappingByPanelAndEmoji(panel_id, emoji);
  }

  RemoveReactionRoleMappingByPanelAndEmoji(
    panel_id: number,
    emoji: string,
  ): ReactionRoleMapping | null {
    return this.reactionRoles.RemoveMappingByPanelAndEmoji(panel_id, emoji);
  }

  ListReactionRoleMappings(panel_id: number): ReactionRoleMapping[] {
    return this.reactionRoles.ListMappings(panel_id);
  }

  GetReactionRoleMappingByEmoji(
    guild_id: string,
    message_id: string,
    emoji: string,
  ): (ReactionRoleMapping & { panel_id: number }) | null {
    return this.reactionRoles.GetMappingByEmoji(guild_id, message_id, emoji);
  }

  ListAllReactionRoleMappings(guild_id: string): Array<
    ReactionRoleMapping & {
      message_id: string;
      channel_id: string;
    }
  > {
    return this.reactionRoles.ListAllMappings(guild_id);
  }

  GetStarboardEntry(
    guild_id: string,
    source_message_id: string,
  ): StarboardEntry | null {
    return this.starboard.GetEntry(guild_id, source_message_id);
  }

  CreateStarboardEntry(data: {
    guild_id: string;
    source_channel_id: string;
    source_message_id: string;
    starboard_message_id: string;
    star_count: number;
  }): StarboardEntry {
    return this.starboard.CreateEntry(data);
  }

  UpdateStarboardEntryCount(
    guild_id: string,
    source_message_id: string,
    star_count: number,
  ): boolean {
    return this.starboard.UpdateStarCount(
      guild_id,
      source_message_id,
      star_count,
    );
  }

  DeleteStarboardEntry(guild_id: string, source_message_id: string): boolean {
    return this.starboard.DeleteEntry(guild_id, source_message_id);
  }

  Close(): void {
    this.db.close();
  }
}
