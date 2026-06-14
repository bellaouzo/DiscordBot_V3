import { describe, expect, it, vi } from "vitest";
import { createMockDatabaseSet } from "../../helpers";
import { SaveSetupDraft, ValidateSetupDraft } from "@systems/Setup/persistence/SaveSetupDraft";
import type { SetupDraft } from "@systems/Setup/state";

function createFullDraft(): SetupDraft {
  return {
    adminRoleIds: ["admin-role"],
    modRoleIds: ["mod-role"],
    ticketCategoryId: "cat-1",
    appealReviewCategoryId: null,
    commandLogChannelId: null,
    ticketLogChannelId: null,
    announcementChannelId: null,
    deleteLogChannelId: null,
    productionLogChannelId: null,
    welcomeChannelId: null,
    economyEnabled: true,
    levelingEnabled: false,
    starboardEnabled: false,
    verificationEnabled: false,
    giveawaysEnabled: true,
    starboardChannelId: null,
    levelUpChannelId: null,
    verificationChannelId: null,
    unverifiedRoleId: null,
    verifiedRoleId: null,
  };
}

describe("SaveSetupDraft", () => {
  it("rejects save when admin roles are missing", () => {
    const draft = createFullDraft();
    draft.adminRoleIds = [];

    const result = ValidateSetupDraft(draft);
    expect(result.error).toContain("admin role");
  });

  it("persists guild settings and xp settings", () => {
    const databases = createMockDatabaseSet();
    const draft = createFullDraft();
    draft.levelingEnabled = true;
    draft.starboardEnabled = true;
    draft.starboardChannelId = "starboard-1";

    vi.mocked(databases.serverDb.UpsertGuildSettings).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: draft.adminRoleIds,
      mod_role_ids: draft.modRoleIds,
      ticket_category_id: draft.ticketCategoryId,
      appeal_review_category_id: null,
      command_log_channel_id: null,
      ticket_log_channel_id: null,
      announcement_channel_id: null,
      delete_log_channel_id: null,
      production_log_channel_id: null,
      welcome_channel_id: null,
      autorole_id: null,
      starboard_channel_id: "starboard-1",
      starboard_emoji: "⭐",
      starboard_threshold: 3,
      roblox_linked_discord_user_id: null,
      roblox_linked_at: null,
      verification_enabled: false,
      unverified_role_id: null,
      verified_role_id: null,
      verification_min_account_age_days: 0,
      verification_channel_id: null,
      economy_enabled: true,
      giveaways_enabled: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const result = SaveSetupDraft({
      serverDb: databases.serverDb,
      guildId: "guild-1",
      draft,
    });

    expect(result.success).toBe(true);
    expect(databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        economy_enabled: true,
        giveaways_enabled: true,
        starboard_channel_id: "starboard-1",
      }),
    );
    expect(databases.serverDb.UpsertGuildXpSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        enabled: true,
      }),
    );
  });

  it("clears starboard channel when starboard module is disabled", () => {
    const databases = createMockDatabaseSet();
    const draft = createFullDraft();
    draft.starboardEnabled = false;
    draft.starboardChannelId = "starboard-1";

    vi.mocked(databases.serverDb.UpsertGuildSettings).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: draft.adminRoleIds,
      mod_role_ids: draft.modRoleIds,
      ticket_category_id: null,
      appeal_review_category_id: null,
      command_log_channel_id: null,
      ticket_log_channel_id: null,
      announcement_channel_id: null,
      delete_log_channel_id: null,
      production_log_channel_id: null,
      welcome_channel_id: null,
      autorole_id: null,
      starboard_channel_id: null,
      starboard_emoji: "⭐",
      starboard_threshold: 3,
      roblox_linked_discord_user_id: null,
      roblox_linked_at: null,
      verification_enabled: false,
      unverified_role_id: null,
      verified_role_id: null,
      verification_min_account_age_days: 0,
      verification_channel_id: null,
      economy_enabled: true,
      giveaways_enabled: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    SaveSetupDraft({
      serverDb: databases.serverDb,
      guildId: "guild-1",
      draft,
    });

    expect(databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        starboard_channel_id: null,
      }),
    );
  });
});
