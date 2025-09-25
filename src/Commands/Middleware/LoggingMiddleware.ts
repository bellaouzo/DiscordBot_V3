import { CommandMiddleware } from './index'

export const LoggingMiddleware: CommandMiddleware = {
  name: 'logging',
  execute: async (context, next) => {
    const start = Date.now()
    context.logger.Info('Command starting', {
      command: context.command.data.name,
      user: context.interaction.user.id,
      guild: context.interaction.guildId
    })

    await next()

    const duration = Date.now() - start
    context.logger.Info('Command completed', {
      command: context.command.data.name,
      duration
    })
  }
}

