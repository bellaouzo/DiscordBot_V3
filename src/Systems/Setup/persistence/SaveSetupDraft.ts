import type { ServerDatabase } from "@database/ServerDatabase";
import type { GuildSettings } from "@database/Server/Types";
import type { SetupDraft } from "../state";

export interface SetupValidationResult {
  readonly error?: string;
  readonly warnings: string[];
}

export function ValidateSetupDraft(draft: SetupDraft): SetupValidationResult {
  const warnings: string[] = [];

  if (draft.adminRoleIds.length === 0) {
    return {
      error: "Select at least one admin role before saving.",
      warnings,
    };
  }

  if (draft.starboardEnabled && !draft.starboardChannelId) {
    warnings.push(
      "Starboard is enabled but no channel is selected — it will auto-manage a #starboard channel.",
    );
  }

  if (draft.verificationEnabled && !draft.unverifiedRoleId) {
    warnings.push(
      "Verification is enabled but no unverified role is selected.",
    );
  }

  if (draft.verificationEnabled && !draft.verificationChannelId) {
    warnings.push(
      "Verification is enabled but no verification channel is selected.",
    );
  }

  return { warnings };
}

export interface SaveSetupDraftResult {
  readonly success: true;
  readonly guildSettings: GuildSettings;
}

export interface SaveSetupDraftFailure {
  readonly success: false;
  readonly error: string;
  readonly warnings: string[];
}

export function SaveSetupDraft(options: {
  serverDb: ServerDatabase;
  guildId: string;
  draft: SetupDraft;
}): SaveSetupDraftResult | SaveSetupDraftFailure {
  const validation = ValidateSetupDraft(options.draft);
  if (validation.error) {
    return {
      success: false,
      error: validation.error,
      warnings: validation.warnings,
    };
  }

  const guildSettings = options.serverDb.UpsertGuildSettings({
    guild_id: options.guildId,
    admin_role_ids: options.draft.adminRoleIds,
    mod_role_ids: options.draft.modRoleIds,
    ticket_category_id: options.draft.ticketCategoryId,
    appeal_review_category_id: options.draft.appealReviewCategoryId,
    command_log_channel_id: options.draft.commandLogChannelId,
    ticket_log_channel_id: options.draft.ticketLogChannelId,
    announcement_channel_id: options.draft.announcementChannelId,
    delete_log_channel_id: options.draft.deleteLogChannelId,
    production_log_channel_id: options.draft.productionLogChannelId,
    welcome_channel_id: options.draft.welcomeChannelId,
    economy_enabled: options.draft.economyEnabled,
    giveaways_enabled: options.draft.giveawaysEnabled,
    verification_enabled: options.draft.verificationEnabled,
    verification_channel_id: options.draft.verificationChannelId,
    unverified_role_id: options.draft.unverifiedRoleId,
    verified_role_id: options.draft.verifiedRoleId,
    starboard_channel_id: options.draft.starboardEnabled
      ? options.draft.starboardChannelId
      : null,
  });

  options.serverDb.UpsertGuildXpSettings({
    guild_id: options.guildId,
    enabled: options.draft.levelingEnabled,
    level_up_channel_id: options.draft.levelingEnabled
      ? options.draft.levelUpChannelId
      : null,
  });

  return { success: true, guildSettings };
}
