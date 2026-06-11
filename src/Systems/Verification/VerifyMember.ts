import type { GuildMember } from "discord.js";
import type { GuildSettings } from "@database/Server/Types";
import { TryAssignAutorole, ValidateAssignableRole } from "@utilities";

export type VerifyMemberResult =
  | { success: true }
  | { success: false; reason: string };

export interface VerificationEligibility {
  readonly alreadyVerified: boolean;
  readonly eligible: boolean;
  readonly accountAgeDays: number;
  readonly minAccountAgeDays: number;
  readonly daysRemaining: number;
  readonly hasUnverifiedRole: boolean;
}

export function GetAccountAgeDays(member: GuildMember): number {
  const ageMs = Date.now() - member.user.createdTimestamp;
  return Math.floor(ageMs / 86_400_000);
}

export function BuildVerificationEligibility(
  member: GuildMember,
  settings: GuildSettings,
): VerificationEligibility {
  const minAccountAgeDays = settings.verification_min_account_age_days;
  const accountAgeDays = GetAccountAgeDays(member);
  const hasUnverifiedRole = Boolean(
    settings.unverified_role_id &&
      member.roles.cache.has(settings.unverified_role_id),
  );
  const alreadyVerified =
    settings.verification_enabled && !hasUnverifiedRole;
  const daysRemaining = Math.max(0, minAccountAgeDays - accountAgeDays);
  const meetsAge =
    minAccountAgeDays <= 0 || accountAgeDays >= minAccountAgeDays;
  const eligible = Boolean(
    hasUnverifiedRole && meetsAge && settings.verification_enabled,
  );

  return {
    alreadyVerified,
    eligible,
    accountAgeDays,
    minAccountAgeDays,
    daysRemaining,
    hasUnverifiedRole,
  };
}

export function ValidateVerificationSettings(
  settings: GuildSettings | null,
): VerifyMemberResult {
  if (!settings?.verification_enabled) {
    return { success: false, reason: "Verification is not enabled." };
  }

  if (!settings.unverified_role_id) {
    return {
      success: false,
      reason: "Verification is enabled but no unverified role is configured.",
    };
  }

  return { success: true };
}

export async function VerifyGuildMember(options: {
  member: GuildMember;
  settings: GuildSettings;
  skipAccountAgeCheck?: boolean;
}): Promise<VerifyMemberResult> {
  const { member, settings, skipAccountAgeCheck = false } = options;
  const guild = member.guild;

  if (!settings.verification_enabled || !settings.unverified_role_id) {
    return { success: false, reason: "Verification is not configured." };
  }

  if (!member.roles.cache.has(settings.unverified_role_id)) {
    return { success: false, reason: "You are already verified." };
  }

  if (!skipAccountAgeCheck && settings.verification_min_account_age_days > 0) {
    const accountAgeDays = GetAccountAgeDays(member);
    if (accountAgeDays < settings.verification_min_account_age_days) {
      const daysRemaining =
        settings.verification_min_account_age_days - accountAgeDays;
      return {
        success: false,
        reason: `Your account must be at least ${settings.verification_min_account_age_days} day(s) old. Try again in ${daysRemaining} day(s).`,
      };
    }
  }

  try {
    await member.roles.remove(
      settings.unverified_role_id,
      "Member verification",
    );
  } catch {
    return {
      success: false,
      reason: "Failed to remove the unverified role. Contact staff.",
    };
  }

  if (settings.verified_role_id) {
    const verifiedRole = await guild.roles.fetch(settings.verified_role_id);
    const validation = ValidateAssignableRole(guild, verifiedRole);

    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    if (!member.roles.cache.has(settings.verified_role_id)) {
      await member.roles.add(settings.verified_role_id, "Member verification");
    }
  }

  if (settings.autorole_id) {
    try {
      await TryAssignAutorole(member, settings.autorole_id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to assign autorole.";
      return { success: false, reason: message };
    }
  }

  return { success: true };
}

export async function AssignUnverifiedRole(
  member: GuildMember,
  settings: GuildSettings,
): Promise<void> {
  if (!settings.verification_enabled || !settings.unverified_role_id) {
    return;
  }

  const role = await member.guild.roles.fetch(settings.unverified_role_id);
  const validation = ValidateAssignableRole(member.guild, role);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (!member.roles.cache.has(settings.unverified_role_id)) {
    await member.roles.add(settings.unverified_role_id, "Unverified on join");
  }
}
