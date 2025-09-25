import { PermissionFlagsBits, PermissionsBitField, GuildMember, ChatInputCommandInteraction } from 'discord.js'
import { CommandMiddleware } from './index'
import { ResponderSet } from '../../Responders'
import { CreateErrorMessage } from '../../Responders/MessageFactory'

async function SendPermissionError(
  responders: ResponderSet,
  interaction: ChatInputCommandInteraction,
  title: string,
  description: string
): Promise<void> {
  const message = CreateErrorMessage({
    title: `❌ ${title}`,
    description
  })
  await responders.replyResponder.Send(interaction, {
    ...message,
    ephemeral: true
  })
}

function FormatPermissionName(permission: string): string {
  return permission
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

function GetValidPermissionValues(permissions: string[]): bigint[] {
  return permissions
    .map(perm => PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits])
    .filter((value): value is bigint => Boolean(value))
}

function GetMissingPermissions(requiredPermissions: string[], memberPermissions: PermissionsBitField, requireAny: boolean): string[] {
  const permissionValues = GetValidPermissionValues(requiredPermissions)
  
  if (requireAny) {
    const hasAny = permissionValues.some(permission => memberPermissions.has(permission))
    return hasAny ? [] : requiredPermissions
  } else {
    return requiredPermissions.filter(perm => {
      const permissionValue = PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits]
      return permissionValue && !memberPermissions.has(permissionValue)
    })
  }
}

async function CheckOwnerPermission(
  context: { interaction: ChatInputCommandInteraction; config: any; responders: ResponderSet }
): Promise<boolean> {
  if (!context.config.owner) return true

  const ownerId = context.interaction.guild?.ownerId
  if (context.interaction.user.id !== ownerId) {
    await SendPermissionError(
      context.responders,
      context.interaction,
      'Owner Only Command',
      'Only the server owner can use this command.'
    )
    return false
  }
  return true
}

async function CheckRolePermission(
  context: { interaction: ChatInputCommandInteraction; config: any; responders: ResponderSet; member: GuildMember }
): Promise<boolean> {
  if (!context.config.role) return true

  const memberRoles = context.member?.roles?.cache ? Array.from(context.member.roles.cache.keys()) : []
  if (!memberRoles.includes(context.config.role)) {
    const requiredRole = context.interaction.guild?.roles.cache.get(context.config.role)
    const roleName = requiredRole?.name || `Role ID: ${context.config.role}`
    
    await SendPermissionError(
      context.responders,
      context.interaction,
      'Missing Required Role',
      `You need the **${roleName}** role to use this command.`
    )
    return false
  }
  
  return true
}

async function CheckDiscordPermissions(
  context: { interaction: ChatInputCommandInteraction; config: any; responders: ResponderSet; member: GuildMember }
): Promise<boolean> {
  const config = context.config
  if (!config.permissions?.required?.length) return true

  const requiredPermissions = config.permissions.required
  const requireAny = config.permissions.requireAny ?? false
  
  const permissionValues = GetValidPermissionValues(requiredPermissions)
  const memberPermissions = typeof context.member.permissions === 'string' 
    ? new PermissionsBitField(BigInt(context.member.permissions))
    : context.member.permissions

  const hasPermissions = requireAny
    ? permissionValues.some(permission => memberPermissions.has(permission))
    : permissionValues.every(permission => memberPermissions.has(permission))

  if (!hasPermissions) {
    const missingPermissions = GetMissingPermissions(requiredPermissions, memberPermissions, requireAny)
    const formattedPermissions = missingPermissions.map(FormatPermissionName)
    
    const title = requireAny ? 'Missing Required Permission' : 'Missing Required Permissions'
    
    let description: string
    if (requireAny) {
      description = `You need at least one of these permissions:\n• ${formattedPermissions.join('\n• ')}`
    } else {
      description = formattedPermissions.length === 1
        ? `You need the **${formattedPermissions[0]}** permission to use this command.`
        : `You need these permissions:\n• ${formattedPermissions.join('\n• ')}`
    }
    
    await SendPermissionError(context.responders, context.interaction, title, description)
    return false
  }
  return true
}

export const PermissionMiddleware: CommandMiddleware = {
  name: 'permissions',
  execute: async (context, next) => {
    const member = context.interaction.member as GuildMember
    const permissions = member?.permissions

    if (!permissions) {
      await SendPermissionError(
        context.responders,
        context.interaction,
        'Permission Check Failed',
        'Unable to determine your permissions for this command.'
      )
      return
    }

    const checks = [
      () => CheckOwnerPermission(context),
      () => CheckRolePermission({ ...context, member }),
      () => CheckDiscordPermissions({ ...context, member })
    ]

    for (const check of checks) {
      if (!(await check())) return
    }

    await next()
  }
}