import { CommandMiddleware } from './index'

export const LoggingMiddleware: CommandMiddleware = {
  name: 'logging',
  execute: async (context, next) => {
    const userId = context.interaction.user.id

    // context.logger.Info('Command starting', {
    //   command: context.command.data.name,
    //   user: context.interaction.user.id,
    //   guild: context.interaction.guildId
    // })

    await next()

    context.logger.Info(`Command ran`, {
      command: context.command.data.name,
      interactionId: context.interaction.id,
      userId,
    })
  }
}

