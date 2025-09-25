import { CommandMiddleware } from './index'

const cooldowns = new Map<string, number>() // Key: userId:commandName, Value: timestamp

export const CooldownMiddleware: CommandMiddleware = {
  name: 'cooldown',
  execute: async (context, next) => {
    const config = context.config
    const cooldownConfig = config.cooldown

    if (!cooldownConfig) {
      await next()
      return
    }

    const userId = context.interaction.user.id
    const commandName = context.command.data.name

    // Calculate cooldown in milliseconds
    let cooldownMs = 0
    if (cooldownConfig.milliseconds) {
      cooldownMs = cooldownConfig.milliseconds
    } else if (cooldownConfig.seconds) {
      cooldownMs = cooldownConfig.seconds * 1000
    } else if (cooldownConfig.minutes) {
      cooldownMs = cooldownConfig.minutes * 60 * 1000
    }

    if (cooldownMs === 0) {
      await next()
      return
    }

    const key = `${userId}:${commandName}`
    const lastUsed = cooldowns.get(key)
    const now = Date.now()

    if (lastUsed && (now - lastUsed) < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000)
      await context.responders.replyResponder.Send(context.interaction, {
        content: `Please wait ${remaining} seconds before using this command again.`,
        ephemeral: true
      })
      return
    }

    cooldowns.set(key, now)
    await next()
  }
}