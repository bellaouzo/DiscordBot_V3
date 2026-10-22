import type { GuildMember } from "discord.js";
import {
  PermissionFlagsBits,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import type { CommandMiddleware, MiddlewareContext } from "./index";
import { CreateErrorMessage } from "@responders/MessageFactory";
import { CreateGuildResourceLocator } from "@utilities/GuildResourceLocator";
import { IsAdmin, IsModerator } from "@utilities/StaffPermissions";
import { ResolveInteractionMember } from "@utilities/GuildMemberResolver";
import type { PermissionName } from "@commands/Middleware/CommandConfig";
import { IsBotOwner } from "@config/AppConfig";

async function SendPermissionError(
  context: MiddlewareContext,
  title: string,
  description: string,
): Promise<void> {
  const message = CreateErrorMessage({
    title: `❌ ${title}`,
    description,
  });
  await context.responders.interactionResponder.Reply(context.interaction, {
    ...message,
    flags: MessageFlags.Ephemeral,
  });
}

export function FormatPermissionName(permission: string): string {
  return permission
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

async function DescribeRoles(
  context: MiddlewareContext,
  roleIds: readonly string[],
  fallback: string,
): Promise<string> {
  const guild = context.interaction.guild;
  if (!guild) {
    return fallback;
  }

  const locator = CreateGuildResourceLocator({ guild, logger: context.logger });
  const names: string[] = [];
  for (const roleId of roleIds) {
    const role = await locator.GetRole(roleId);
    if (role) {
      names.push(role.name);
    }
  }
  return names.length > 0 ? names.join(", ") : fallback;
}

async function CheckStaffAccess(
  context: MiddlewareContext,
  member: GuildMember,
  level: "mod" | "admin",
): Promise<boolean> {
  const guild = context.interaction.guild;
  if (!guild) {
    await SendPermissionError(
      context,
      "Permission Check Failed",
      "This command can only be used in a server.",
    );
    return false;
  }

  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const allowed =
    level === "admin"
      ? IsAdmin(member, settings)
      : IsModerator(member, settings);
  if (allowed) {
    return true;
  }

  const roleIds =
    (level === "admin" ? settings?.admin_role_ids : settings?.mod_role_ids) ??
    [];
  if (roleIds.length === 0) {
    await SendPermissionError(
      context,
      "Setup Required",
      "This server has not been set up yet. Ask someone with **Administrator** permission to run `/setup` first.",
    );
    return false;
  }

  const roleList = await DescribeRoles(
    context,
    roleIds,
    `a configured ${level} role`,
  );
  await SendPermissionError(
    context,
    level === "admin" ? "Missing Admin Role" : "Missing Mod Role",
    `You need one of the following ${level} roles to use this command: **${roleList}**`,
  );
  return false;
}

async function CheckAccess(
  context: MiddlewareContext,
  member: GuildMember | null,
): Promise<boolean> {
  switch (context.config.access) {
    case "everyone":
      return true;
    case "botOwner":
      if (IsBotOwner(context.interaction.user.id, context.appConfig)) {
        return true;
      }
      await SendPermissionError(
        context,
        "Bot Owner Only",
        "Only the bot's owners can use this command.",
      );
      return false;
    case "serverOwner":
      if (context.interaction.user.id === context.interaction.guild?.ownerId) {
        return true;
      }
      await SendPermissionError(
        context,
        "Owner Only Command",
        "Only the server owner can use this command.",
      );
      return false;
    case "admin":
    case "mod":
      return (
        member !== null &&
        CheckStaffAccess(context, member, context.config.access)
      );
  }
}

async function CheckRole(
  context: MiddlewareContext,
  member: GuildMember | null,
): Promise<boolean> {
  const roleId = context.config.role;
  if (!roleId || member?.roles?.cache?.has(roleId)) {
    return true;
  }

  const roleName = await DescribeRoles(context, [roleId], `Role ID: ${roleId}`);
  await SendPermissionError(
    context,
    "Missing Required Role",
    `You need the **${roleName}** role to use this command.`,
  );
  return false;
}

function ListMissingPermissions(
  required: readonly PermissionName[],
  memberPermissions: PermissionsBitField,
  requireAny: boolean,
): PermissionName[] {
  const missing = required.filter(
    (permission) => !memberPermissions.has(PermissionFlagsBits[permission]),
  );
  if (requireAny) {
    return missing.length < required.length ? [] : [...required];
  }
  return missing;
}

async function CheckUserPermissions(
  context: MiddlewareContext,
  member: GuildMember | null,
): Promise<boolean> {
  const { userPermissions, anyUserPermission } = context.config;
  if (userPermissions.length === 0 || !member) {
    return true;
  }

  const memberPermissions =
    member.permissions instanceof PermissionsBitField
      ? member.permissions
      : new PermissionsBitField(member.permissions);
  const missing = ListMissingPermissions(
    userPermissions,
    memberPermissions,
    anyUserPermission,
  );
  if (missing.length === 0) {
    return true;
  }

  const formatted = missing.map(FormatPermissionName);
  const title = anyUserPermission
    ? "Missing Required Permission"
    : "Missing Required Permissions";
  const description = anyUserPermission
    ? `You need at least one of these permissions:\n• ${formatted.join("\n• ")}`
    : formatted.length === 1
      ? `You need the **${formatted[0]}** permission to use this command.`
      : `You need these permissions:\n• ${formatted.join("\n• ")}`;

  await SendPermissionError(context, title, description);
  return false;
}

/**
 * Enforces `access`, `role` and `userPermissions` from the command config.
 */
export const PermissionMiddleware: CommandMiddleware = {
  name: "permissions",
  execute: async (context, next) => {
    // Only staff, role and permission checks need the member; owner checks also work in DMs.
    const { access, role, userPermissions } = context.config;
    const needsMember =
      access === "mod" ||
      access === "admin" ||
      Boolean(role) ||
      userPermissions.length > 0;
    const member = needsMember
      ? await ResolveInteractionMember(context.interaction)
      : null;

    if (needsMember && !member?.permissions) {
      await SendPermissionError(
        context,
        "Permission Check Failed",
        "Unable to determine your permissions for this command.",
      );
      return;
    }

    const checks = [CheckAccess, CheckRole, CheckUserPermissions];
    for (const check of checks) {
      if (!(await check(context, member))) {
        return;
      }
    }

    await next();
  },
};
