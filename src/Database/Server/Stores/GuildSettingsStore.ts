import type Database from "better-sqlite3";
import type { Logger } from "@shared/Logger";
import { MapGuildSettings, NormalizeIds } from "@database/Server/Mappers";
import type { GuildSettings, GuildSettingsRow } from "@database/Server/Types";

export class GuildSettingsStore {
  constructor(
    private readonly db: Database.Database,
    private readonly logger: Logger,
  ) {}

  GetGuildSettings(guild_id: string): GuildSettings | null {
    const stmt = this.db.prepare(
      `
      SELECT guild_id, admin_role_ids, mod_role_ids, ticket_category_id, appeal_review_category_id, command_log_channel_id, ticket_log_channel_id, announcement_channel_id, delete_log_channel_id, production_log_channel_id, welcome_channel_id, autorole_id, starboard_channel_id, starboard_emoji, starboard_threshold, roblox_linked_discord_user_id, roblox_linked_at, verification_enabled, unverified_role_id, verified_role_id, verification_min_account_age_days, verification_channel_id, economy_enabled, giveaways_enabled, created_at, updated_at
      FROM guild_settings
      WHERE guild_id = ?
    `,
    );

    const row = stmt.get(guild_id) as GuildSettingsRow | undefined;

    if (!row) {
      return null;
    }

    return MapGuildSettings(row, this.logger);
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
  }): GuildSettings {
    const existing = this.GetGuildSettings(settings.guild_id);
    const now = Date.now();
    const adminRoles = NormalizeIds(
      settings.admin_role_ids ?? existing?.admin_role_ids ?? [],
    );
    const modRoles = NormalizeIds(
      settings.mod_role_ids ?? existing?.mod_role_ids ?? [],
    );
    const ticketCategoryId =
      settings.ticket_category_id ?? existing?.ticket_category_id ?? null;
    const appealReviewCategoryId =
      settings.appeal_review_category_id ??
      existing?.appeal_review_category_id ??
      null;
    const commandLogChannelId =
      settings.command_log_channel_id ??
      existing?.command_log_channel_id ??
      null;
    const ticketLogChannelId =
      settings.ticket_log_channel_id ?? existing?.ticket_log_channel_id ?? null;
    const announcementChannelId =
      settings.announcement_channel_id ??
      existing?.announcement_channel_id ??
      null;
    const deleteLogChannelId =
      settings.delete_log_channel_id ?? existing?.delete_log_channel_id ?? null;
    const productionLogChannelId =
      settings.production_log_channel_id ??
      existing?.production_log_channel_id ??
      null;
    const welcomeChannelId =
      settings.welcome_channel_id ?? existing?.welcome_channel_id ?? null;
    const autoroleId =
      settings.autorole_id !== undefined
        ? settings.autorole_id
        : (existing?.autorole_id ?? null);
    const starboardChannelId =
      settings.starboard_channel_id !== undefined
        ? settings.starboard_channel_id
        : (existing?.starboard_channel_id ?? null);
    const starboardEmoji =
      settings.starboard_emoji ?? existing?.starboard_emoji ?? "⭐";
    const starboardThreshold =
      settings.starboard_threshold ?? existing?.starboard_threshold ?? 3;
    const robloxLinkedDiscordUserId =
      settings.roblox_linked_discord_user_id ??
      existing?.roblox_linked_discord_user_id ??
      null;
    const robloxLinkedAt =
      settings.roblox_linked_at ?? existing?.roblox_linked_at ?? null;
    const verificationEnabled =
      settings.verification_enabled ?? existing?.verification_enabled ?? false;
    const unverifiedRoleId =
      settings.unverified_role_id !== undefined
        ? settings.unverified_role_id
        : (existing?.unverified_role_id ?? null);
    const verifiedRoleId =
      settings.verified_role_id !== undefined
        ? settings.verified_role_id
        : (existing?.verified_role_id ?? null);
    const verificationMinAccountAgeDays =
      settings.verification_min_account_age_days ??
      existing?.verification_min_account_age_days ??
      0;
    const verificationChannelId =
      settings.verification_channel_id !== undefined
        ? settings.verification_channel_id
        : (existing?.verification_channel_id ?? null);
    const economyEnabled =
      settings.economy_enabled ?? existing?.economy_enabled ?? true;
    const giveawaysEnabled =
      settings.giveaways_enabled ?? existing?.giveaways_enabled ?? true;
    const createdAt = existing?.created_at ?? now;

    const stmt = this.db.prepare(
      `
      INSERT INTO guild_settings (
        guild_id,
        admin_role_ids,
        mod_role_ids,
        ticket_category_id,
        appeal_review_category_id,
        command_log_channel_id,
        ticket_log_channel_id,
        announcement_channel_id,
        delete_log_channel_id,
        production_log_channel_id,
        welcome_channel_id,
        autorole_id,
        starboard_channel_id,
        starboard_emoji,
        starboard_threshold,
        roblox_linked_discord_user_id,
        roblox_linked_at,
        verification_enabled,
        unverified_role_id,
        verified_role_id,
        verification_min_account_age_days,
        verification_channel_id,
        economy_enabled,
        giveaways_enabled,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        admin_role_ids = excluded.admin_role_ids,
        mod_role_ids = excluded.mod_role_ids,
        ticket_category_id = excluded.ticket_category_id,
        appeal_review_category_id = excluded.appeal_review_category_id,
        command_log_channel_id = excluded.command_log_channel_id,
        ticket_log_channel_id = excluded.ticket_log_channel_id,
        announcement_channel_id = excluded.announcement_channel_id,
        delete_log_channel_id = excluded.delete_log_channel_id,
        production_log_channel_id = excluded.production_log_channel_id,
        welcome_channel_id = excluded.welcome_channel_id,
        autorole_id = excluded.autorole_id,
        starboard_channel_id = excluded.starboard_channel_id,
        starboard_emoji = excluded.starboard_emoji,
        starboard_threshold = excluded.starboard_threshold,
        roblox_linked_discord_user_id = excluded.roblox_linked_discord_user_id,
        roblox_linked_at = excluded.roblox_linked_at,
        verification_enabled = excluded.verification_enabled,
        unverified_role_id = excluded.unverified_role_id,
        verified_role_id = excluded.verified_role_id,
        verification_min_account_age_days = excluded.verification_min_account_age_days,
        verification_channel_id = excluded.verification_channel_id,
        economy_enabled = excluded.economy_enabled,
        giveaways_enabled = excluded.giveaways_enabled,
        updated_at = excluded.updated_at
    `,
    );

    stmt.run(
      settings.guild_id,
      JSON.stringify(adminRoles),
      JSON.stringify(modRoles),
      ticketCategoryId,
      appealReviewCategoryId,
      commandLogChannelId,
      ticketLogChannelId,
      announcementChannelId,
      deleteLogChannelId,
      productionLogChannelId,
      welcomeChannelId,
      autoroleId,
      starboardChannelId,
      starboardEmoji,
      starboardThreshold,
      robloxLinkedDiscordUserId,
      robloxLinkedAt,
      verificationEnabled ? 1 : 0,
      unverifiedRoleId,
      verifiedRoleId,
      verificationMinAccountAgeDays,
      verificationChannelId,
      economyEnabled ? 1 : 0,
      giveawaysEnabled ? 1 : 0,
      createdAt,
      now,
    );

    const saved = this.GetGuildSettings(settings.guild_id);
    if (!saved) {
      throw new Error("Failed to save guild settings");
    }

    return saved;
  }
}
