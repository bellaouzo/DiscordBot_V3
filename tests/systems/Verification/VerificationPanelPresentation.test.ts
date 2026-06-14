import { describe, expect, it } from "vitest";
import {
  BuildVerificationPanelEmbed,
  CollectVerificationGrantRoleIds,
} from "@systems/Verification/VerificationPanelPresentation";
import type { GuildSettings } from "@database/Server/Types";

function CreateSettings(): GuildSettings {
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
    autorole_id: "autorole-1",
    starboard_channel_id: null,
    starboard_emoji: "⭐",
    starboard_threshold: 3,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
    verification_enabled: true,
    unverified_role_id: "unverified",
    verified_role_id: "verified",
    verification_min_account_age_days: 3,
    verification_channel_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

describe("VerificationPanelPresentation", () => {
  it("deduplicates grant roles when verified and autorole are the same", () => {
    const settings = CreateSettings();
    settings.autorole_id = settings.verified_role_id;

    expect(CollectVerificationGrantRoleIds(settings)).toEqual(["verified"]);
  });

  it("builds a rich panel embed with steps and requirements", () => {
    const embed = BuildVerificationPanelEmbed(
      {
        name: "Test Guild",
        memberCount: 420,
        iconURL: () => "https://example.com/icon.png",
      } as Parameters<typeof BuildVerificationPanelEmbed>[0],
      CreateSettings(),
    );

    expect(embed.title).toContain("Test Guild");
    expect(
      embed.fields?.some((field) => field.name.includes("How to verify")),
    ).toBe(true);
    expect(embed.fields?.some((field) => field.value?.includes("3"))).toBe(
      true,
    );
    expect(embed.footer?.text).toContain("420");
  });
});
