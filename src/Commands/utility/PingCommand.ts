import { ChatInputCommandInteraction } from 'discord.js'
import { CommandContext, CreateCommand } from '../CommandFactory'
import { LoggingMiddleware } from '../Middleware/LoggingMiddleware'
import { CooldownMiddleware } from '../Middleware/CooldownMiddleware'
import { ErrorMiddleware } from '../Middleware/ErrorMiddleware'
import { Config } from '../Middleware/CommandConfig'

async function ExecutePing(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void> {
  const { actionResponder } = context.responders

  await actionResponder.Send({
    interaction,
    message: 'Pinging...',
    followUp: `Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`,
    action: async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  })
}

export const PingCommand = CreateCommand({
  name: 'ping',
  description: 'Replies with Pong!',
  group: 'utility',
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(1),
  execute: ExecutePing
})