import { GuildMember, PermissionFlagsBits } from "discord.js";
import { GuildSettings } from "@database/ServerDatabase";

export interface StaffPermissionOptions {
  adminRoleIds?: string[];
  modRoleIds?: string[];
}

function ResolveRoleOptions(
  settings?: GuildSettings | StaffPermissionOptions | null,
): StaffPermissionOptions {
  if (!settings) {
    return {};
  }

  if ("guild_id" in settings) {
    return {
      adminRoleIds: settings.admin_role_ids,
      modRoleIds: settings.mod_role_ids,
    };
  }

  return settings;
}

function HasConfiguredRole(
  member: GuildMember,
  roleIds: string[] | undefined,
): boolean {
  if (!roleIds?.length) {
    return false;
  }

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

export function HasConfiguredAdminRole(
  member: GuildMember,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  const roles = ResolveRoleOptions(settings);
  return HasConfiguredRole(member, roles.adminRoleIds);
}

export function HasConfiguredModRole(
  member: GuildMember,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  const roles = ResolveRoleOptions(settings);
  return HasConfiguredRole(member, roles.modRoleIds);
}

export function IsAdmin(
  member: GuildMember | null,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  if (!member) {
    return false;
  }

  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  const roles = ResolveRoleOptions(settings);
  return HasConfiguredRole(member, roles.adminRoleIds);
}

export function IsModerator(
  member: GuildMember | null,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  if (!member) {
    return false;
  }

  if (IsAdmin(member, settings)) {
    return true;
  }

  if (
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers)
  ) {
    return true;
  }

  const roles = ResolveRoleOptions(settings);
  return HasConfiguredRole(member, roles.modRoleIds);
}

export function IsAppealReviewer(
  member: GuildMember | null,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  return IsModerator(member, settings);
}

export function IsTicketStaff(
  member: GuildMember | null,
  settings?: GuildSettings | StaffPermissionOptions | null,
): boolean {
  return IsModerator(member, settings);
}
