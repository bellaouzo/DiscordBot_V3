import {
  PermissionFlagsBits,
  PermissionsBitField,
  GuildMember,
  ChatInputCommandInteraction,
} from "discord.js";
import { CommandMiddleware, MiddlewareContext } from "./index";
import { ResponderSet } from "@responders";
import { CreateErrorMessage } from "@responders/MessageFactory";
import { CreateGuildResourceLocator } from "@utilities/GuildResourceLocator";
import { CommandConfig } from "@commands/Middleware/CommandConfig";
import { Logger } from "@shared/Logger";
import { DatabaseSet } from "@database";

async function SendPermissionError(
  responders: ResponderSet,
  interaction: ChatInputCommandInteraction,
  title: string,
  description: string
): Promise<void> {
  const message = CreateErrorMessage({
    title: `❌ ${title}`,
    description,
  });
  await responders.interactionResponder.Reply(interaction, {
    ...message,
    ephemeral: true,
  });
}

function FormatPermissionName(permission: string): string {
  return permission
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function GetValidPermissionValues(permissions: string[]): bigint[] {
  return permissions
    .map(
      (perm) => PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits]
    )
    .filter((value): value is bigint => Boolean(value));
}

function GetMissingPermissions(
  requiredPermissions: string[],
  memberPermissions: PermissionsBitField,
  requireAny: boolean
): string[] {
  const permissionValues = GetValidPermissionValues(requiredPermissions);

  if (requireAny) {
    const hasAny = permissionValues.some((permission) =>
      memberPermissions.has(permission)
    );
    return hasAny ? [] : requiredPermissions;
  } else {
    return requiredPermissions.filter((perm) => {
      const permissionValue =
        PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
      return permissionValue && !memberPermissions.has(permissionValue);
    });
  }
}

async function CheckOwnerPermission(context: {
  interaction: ChatInputCommandInteraction;
  config: CommandConfig;
  responders: ResponderSet;
}): Promise<boolean> {
  if (!context.config.owner) return true;

  const ownerId = context.interaction.guild?.ownerId;
  if (context.interaction.user.id !== ownerId) {
    await SendPermissionError(
      context.responders,
      context.interaction,
      "Owner Only Command",
      "Only the server owner can use this command."
    );
    return false;
  }
  return true;
}

async function CheckRolePermission(context: {
  interaction: ChatInputCommandInteraction;
  config: CommandConfig;
  responders: ResponderSet;
  member: GuildMember;
  logger?: Logger;
}): Promise<boolean> {
  if (!context.config.role) return true;

  const memberRoles = context.member?.roles?.cache
    ? Array.from(context.member.roles.cache.keys())
    : [];
  if (!memberRoles.includes(context.config.role)) {
    let roleName = `Role ID: ${context.config.role}`;

    if (context.interaction.guild) {
      const locator = CreateGuildResourceLocator({
        guild: context.interaction.guild,
        logger: context.logger,
      });
      const requiredRole = await locator.GetRole(context.config.role);
      if (requiredRole) {
        roleName = requiredRole.name;
      }
    }

    await SendPermissionError(
      context.responders,
      context.interaction,
      "Missing Required Role",
      `You need the **${roleName}** role to use this command.`
    );
    return false;
  }

  return true;
}

async function CheckModRolePermission(context: {
  interaction: ChatInputCommandInteraction;
  config: CommandConfig;
  responders: ResponderSet;
  member: GuildMember;
  logger?: Logger;
  databases: DatabaseSet;
}): Promise<boolean> {
  if (!context.config.modRole) return true;

  if (!context.interaction.guild) {
    await SendPermissionError(
      context.responders,
      context.interaction,
      "Permission Check Failed",
      "This command can only be used in a server."
    );
    return false;
  }

  const guildSettings = context.databases.serverDb.GetGuildSettings(
    context.interaction.guild.id
  );

  if (!guildSettings || !guildSettings.mod_role_ids.length) {
    await SendPermissionError(
      context.responders,
      context.interaction,
      "Mod Role Not Configured",
      "No mod roles have been configured for this server. Please use the setup command to configure mod roles."
    );
    return false;
  }

  const memberRoles = context.member?.roles?.cache
    ? Array.from(context.member.roles.cache.keys())
    : [];

  const hasModRole = guildSettings.mod_role_ids.some((roleId) =>
    memberRoles.includes(roleId)
  );

  if (!hasModRole) {
    const locator = CreateGuildResourceLocator({
      guild: context.interaction.guild,
      logger: context.logger,
    });

    const modRoleNames: string[] = [];
    for (const roleId of guildSettings.mod_role_ids) {
      const role = await locator.GetRole(roleId);
      if (role) {
        modRoleNames.push(role.name);
      }
    }

    const roleList =
      modRoleNames.length > 0
        ? modRoleNames.join(", ")
        : "a configured mod role";

    await SendPermissionError(
      context.responders,
      context.interaction,
      "Missing Mod Role",
      `You need one of the following mod roles to use this command: **${roleList}**`
    );
    return false;
  }

  return true;
}

async function CheckDiscordPermissions(context: {
  interaction: ChatInputCommandInteraction;
  config: CommandConfig;
  responders: ResponderSet;
  member: GuildMember;
}): Promise<boolean> {
  const config = context.config;
  if (!config.permissions?.required?.length) return true;

  const requiredPermissions = config.permissions.required;
  const requireAny = config.permissions.requireAny ?? false;

  const permissionValues = GetValidPermissionValues(requiredPermissions);
  const memberPermissions =
    context.member.permissions instanceof PermissionsBitField
      ? context.member.permissions
      : new PermissionsBitField(context.member.permissions);

  const hasPermissions = requireAny
    ? permissionValues.some((permission) => memberPermissions.has(permission))
    : permissionValues.every((permission) => memberPermissions.has(permission));

  if (!hasPermissions) {
    const missingPermissions = GetMissingPermissions(
      requiredPermissions,
      memberPermissions,
      requireAny
    );
    const formattedPermissions = missingPermissions.map(FormatPermissionName);

    const title = requireAny
      ? "Missing Required Permission"
      : "Missing Required Permissions";

    let description: string;
    if (requireAny) {
      description = `You need at least one of these permissions:\n• ${formattedPermissions.join(
        "\n• "
      )}`;
    } else {
      description =
        formattedPermissions.length === 1
          ? `You need the **${formattedPermissions[0]}** permission to use this command.`
          : `You need these permissions:\n• ${formattedPermissions.join(
              "\n• "
            )}`;
    }

    await SendPermissionError(
      context.responders,
      context.interaction,
      title,
      description
    );
    return false;
  }
  return true;
}

export const PermissionMiddleware: CommandMiddleware = {
  name: "permissions",
  execute: async (context: MiddlewareContext, next) => {
    const member = context.interaction.member as GuildMember;
    const permissions = member?.permissions;

    if (!permissions) {
      await SendPermissionError(
        context.responders,
        context.interaction,
        "Permission Check Failed",
        "Unable to determine your permissions for this command."
      );
      return;
    }

    const checks = [
      () => CheckOwnerPermission(context),
      () => CheckRolePermission({ ...context, member, logger: context.logger }),
      () =>
        CheckModRolePermission({
          ...context,
          member,
          logger: context.logger,
          databases: context.databases,
        }),
      () => CheckDiscordPermissions({ ...context, member }),
    ];

    for (const check of checks) {
      if (!(await check())) return;
    }

    await next();
  },
};
