import { CommandMiddleware } from './index'
import { CreateErrorMessage } from '../../Responders/MessageFactory'

export const ErrorMiddleware: CommandMiddleware = {
  name: 'error-handler',
  execute: async (context, next) => {
    try {
      await next()
    } catch (error) {
      context.logger.Error('Command execution failed', {
        command: context.command.data.name,
        interactionId: context.interaction.id,
        guildId: context.interaction.guildId ?? undefined,
        userId: context.interaction.user.id,
        error
      })

      const message = CreateErrorMessage({
        title: 'Command Failed',
        description: 'Something went wrong while executing this command.',
        hint: 'The incident has been logged.'
      })

      await context.responders.replyResponder.Send(context.interaction, {
        ...message,
        ephemeral: true
      })
    }
  }
}

