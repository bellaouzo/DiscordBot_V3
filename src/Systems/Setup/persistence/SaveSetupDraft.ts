import type { ServerDatabase } from "@database/ServerDatabase";
import type { GuildSettings } from "@database/Server/Types";
import type { SetupDraft } from "../state";
import type { GuildBooleanSettingKey } from "@database/Server/GuildSettingsSchema";
import { TOGGLEABLE_FEATURES } from "@shared/Features";

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

  if (draft.features.verification && !draft.unverifiedRoleId) {
    return {
      error:
        "Verification requires an unverified role. Select the role new members get until they verify, or turn Verification off.",
      warnings,
    };
  }

  if (draft.features.starboard && !draft.starboardChannelId) {
    warnings.push(
      "Starboard is enabled but no channel is selected — it will auto-manage a #starboard channel.",
    );
  }

  if (draft.features.verification && !draft.verificationChannelId) {
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

/**
 * Guild settings for every feature whose toggle is a plain boolean setting. Features with a
 * derived toggle (starboard, leveling) are saved explicitly in SaveSetupDraft.
 */
function FeatureToggleSettings(
  draft: SetupDraft,
): Partial<Record<GuildBooleanSettingKey, boolean>> {
  const settings: Partial<Record<GuildBooleanSettingKey, boolean>> = {};
  for (const feature of TOGGLEABLE_FEATURES) {
    if (feature.toggle.setting) {
      settings[feature.toggle.setting] = draft.features[feature.key];
    }
  }
  return settings;
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
    ...FeatureToggleSettings(options.draft),
    verification_channel_id: options.draft.verificationChannelId,
    unverified_role_id: options.draft.unverifiedRoleId,
    verified_role_id: options.draft.verifiedRoleId,
    starboard_channel_id: options.draft.features.starboard
      ? options.draft.starboardChannelId
      : null,
  });

  options.serverDb.UpsertGuildXpSettings({
    guild_id: options.guildId,
    enabled: options.draft.features.leveling,
    level_up_channel_id: options.draft.features.leveling
      ? options.draft.levelUpChannelId
      : null,
  });

  return { success: true, guildSettings };
}
