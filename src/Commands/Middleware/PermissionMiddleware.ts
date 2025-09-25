import { PermissionFlagsBits, PermissionsBitField, GuildMember } from 'discord.js'
import { CommandMiddleware } from './index'

export const PermissionMiddleware: CommandMiddleware = {
  name: 'permissions',
  execute: async (context, next) => {
    const member = context.interaction.member as GuildMember
    const permissions = member?.permissions

    if (!permissions) {
      await context.responders.replyResponder.Send(context.interaction, {
        content: 'Unable to determine your permissions for this command.',
        ephemeral: true
      })
      return
    }

    const config = context.config

    // Check owner requirement
    if (config.owner) {
      const ownerId = context.interaction.guild?.ownerId
      if (context.interaction.user.id !== ownerId) {
        await context.responders.replyResponder.Send(context.interaction, {
          content: 'Only the server owner can use this command.',
          ephemeral: true
        })
        return
      }
    }

    // Check role requirement
    if (config.role) {
      const memberRoles = member?.roles?.cache ? Array.from(member.roles.cache.keys()) : []
      if (!memberRoles.includes(config.role)) {
        await context.responders.replyResponder.Send(context.interaction, {
          content: 'You do not have the required role for this command.',
          ephemeral: true
        })
        return
      }
    }

    // Check permission requirements
    if (config.permissions?.required?.length) {
      const requiredPermissions = config.permissions.required
      const requireAny = config.permissions.requireAny ?? false
      
      const permissionValues = requiredPermissions.map(perm => 
        PermissionFlagsBits[perm]
      )

      const memberPermissions = typeof permissions === 'string' 
        ? new PermissionsBitField(BigInt(permissions))
        : permissions

      const hasPermissions = requireAny
        ? permissionValues.some(permission => memberPermissions.has(permission))
        : permissionValues.every(permission => memberPermissions.has(permission))

      if (!hasPermissions) {
        const message = requireAny
          ? 'You need at least one of the required permissions for this command.'
          : 'You do not have all the required permissions for this command.'
        
        await context.responders.replyResponder.Send(context.interaction, {
          content: message,
          ephemeral: true
        })
        return
      }
    }

    await next()
  }
}