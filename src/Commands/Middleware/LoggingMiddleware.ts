import { CommandMiddleware } from './index'

export const LoggingMiddleware: CommandMiddleware = {
  name: 'logging',
  execute: async (context, next) => {
    const commandName = context.command.data.name
    const userId = context.interaction.user.id
    const timestamp = new Date().toISOString()

    // context.logger.Info('Command starting', {
    //   command: context.command.data.name,
    //   user: context.interaction.user.id,
    //   guild: context.interaction.guildId
    // })

    await next()

    context.logger.Info(`Command ran`, {
      command: commandName,
      commandName,
      userId,
      timestamp
    })
  }
}

