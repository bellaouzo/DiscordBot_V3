import { Interaction } from 'discord.js'
import { CommandDefinition, CommandContext } from '../Commands/CommandFactory'
import { Logger } from '../Logging/Logger'
import { ResponderSet } from '../Responders'
import { MiddlewareContext, RunMiddlewareChain } from '../Commands/Middleware'

export function CreateCommandExecutor(logger: Logger) {
  return async (command: CommandDefinition, interaction: Interaction, responders: ResponderSet) => {
    if (!interaction.isChatInputCommand()) {
      return
    }

    const middleware = command.middleware?.before ?? []
    const afterMiddleware = command.middleware?.after ?? []

        const context: MiddlewareContext = {
          interaction,
          command,
          logger,
          responders,
          config: command.config ?? {}
        }

    const finalHandler = async () => {
      const commandContext: CommandContext = { responders, logger }
      await command.execute(interaction, commandContext)
    }

    const middlewareChain = [...middleware, ...afterMiddleware]

    await RunMiddlewareChain(middlewareChain, context, finalHandler)
  }
}

