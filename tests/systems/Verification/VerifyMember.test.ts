import { describe, expect, it } from "vitest";
import { ValidateVerificationSettings } from "@systems/Verification/VerifyMember";
import type { GuildSettings } from "@database/Server/Types";

function CreateSettings(
  overrides: Partial<GuildSettings> = {},
): GuildSettings {
  return {
    guild_id: "guild-1",
    admin_role_ids: [],
    mod_role_ids: [],
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
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

describe("VerifyMember", () => {
  it("rejects when verification is disabled", () => {
    const result = ValidateVerificationSettings(
      CreateSettings({ verification_enabled: false }),
    );
    expect(result).toEqual({
      success: false,
      reason: "Verification is not enabled.",
    });
  });

  it("rejects when unverified role is missing", () => {
    const result = ValidateVerificationSettings(
      CreateSettings({ verification_enabled: true, unverified_role_id: null }),
    );
    expect(result).toEqual({
      success: false,
      reason: "Verification is enabled but no unverified role is configured.",
    });
  });

  it("accepts valid verification settings", () => {
    const result = ValidateVerificationSettings(
      CreateSettings({
        verification_enabled: true,
        unverified_role_id: "role-1",
      }),
    );
    expect(result).toEqual({ success: true });
  });
});
