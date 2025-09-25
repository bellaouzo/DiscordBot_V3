import { CommandMiddleware } from './index'

export const ErrorMiddleware: CommandMiddleware = {
  name: 'error-handler',
  execute: async (context, next) => {
    try {
      await next()
    } catch (error) {
      context.logger.Error('Command execution failed', {
        command: context.command.data.name,
        error
      })

      await context.responders.replyResponder.Send(context.interaction, {
        content: 'Something went wrong while executing this command.',
        ephemeral: true
      })
    }
  }
}

