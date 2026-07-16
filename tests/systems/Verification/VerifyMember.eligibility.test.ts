import { describe, expect, it } from "vitest";
import { BuildVerificationEligibility } from "@systems/Verification/VerifyMember";
import type { GuildSettings } from "@database/Server/Types";

function CreateSettings(overrides: Partial<GuildSettings> = {}): GuildSettings {
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
    verification_enabled: true,
    unverified_role_id: "unverified",
    verified_role_id: null,
    verification_min_account_age_days: 7,
    verification_channel_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function CreateMember(options: {
  createdDaysAgo: number;
  roleIds: string[];
}): Parameters<typeof BuildVerificationEligibility>[0] {
  const createdTimestamp = Date.now() - options.createdDaysAgo * 86_400_000;
  return {
    user: { createdTimestamp },
    roles: {
      cache: {
        has: (id: string) => options.roleIds.includes(id),
      },
    },
  } as Parameters<typeof BuildVerificationEligibility>[0];
}

describe("BuildVerificationEligibility", () => {
  it("marks eligible members with unverified role and sufficient account age", () => {
    const eligibility = BuildVerificationEligibility(
      CreateMember({ createdDaysAgo: 30, roleIds: ["unverified"] }),
      CreateSettings(),
    );

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.alreadyVerified).toBe(false);
    expect(eligibility.daysRemaining).toBe(0);
  });

  it("rejects members below minimum account age", () => {
    const eligibility = BuildVerificationEligibility(
      CreateMember({ createdDaysAgo: 2, roleIds: ["unverified"] }),
      CreateSettings({ verification_min_account_age_days: 7 }),
    );

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.daysRemaining).toBe(5);
  });

  it("marks already verified members without unverified role", () => {
    const eligibility = BuildVerificationEligibility(
      CreateMember({ createdDaysAgo: 30, roleIds: ["member"] }),
      CreateSettings(),
    );

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.alreadyVerified).toBe(true);
    expect(eligibility.unverifiedRoleConfigured).toBe(true);
  });

  it("does not treat members as verified when unverified role is not configured", () => {
    const eligibility = BuildVerificationEligibility(
      CreateMember({ createdDaysAgo: 30, roleIds: [] }),
      CreateSettings({ unverified_role_id: null }),
    );

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.alreadyVerified).toBe(false);
    expect(eligibility.unverifiedRoleConfigured).toBe(false);
    expect(eligibility.hasUnverifiedRole).toBe(false);
  });
});
