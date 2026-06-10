import type { Guild, GuildMember, Role } from "discord.js";

export function CanBotAssignRole(guild: Guild, role: Role): boolean {
  const botMember = guild.members.me;
  if (!botMember) {
    return false;
  }

  if (role.managed || role.id === guild.id) {
    return false;
  }

  const botHighest = botMember.roles.highest.position;
  return role.position < botHighest && botMember.permissions.has("ManageRoles");
}

export function ValidateAssignableRole(
  guild: Guild,
  role: Role | null,
): { valid: true } | { valid: false; reason: string } {
  if (!role) {
    return { valid: false, reason: "Role not found." };
  }

  if (role.id === guild.id) {
    return { valid: false, reason: "Cannot assign the @everyone role." };
  }

  if (role.managed) {
    return {
      valid: false,
      reason: "Cannot assign integration-managed roles.",
    };
  }

  if (!CanBotAssignRole(guild, role)) {
    return {
      valid: false,
      reason:
        "I cannot assign that role. Move my highest role above it and ensure I have Manage Roles.",
    };
  }

  return { valid: true };
}

export async function TryAssignAutorole(
  member: GuildMember,
  roleId: string,
): Promise<void> {
  const guild = member.guild;
  const role = await guild.roles.fetch(roleId);
  const validation = ValidateAssignableRole(guild, role);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (member.roles.cache.has(roleId)) {
    return;
  }

  await member.roles.add(roleId, "Autorole on join");
}
