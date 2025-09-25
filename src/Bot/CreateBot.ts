import { Client, Events, GatewayIntentBits } from 'discord.js'
import { Logger } from '../Logging/Logger'

export interface BotDependencies {
  readonly intents?: number[]
  readonly logger: Logger
}

export interface BotLifecycle {
  readonly client: Client
  Start(token: string): Promise<void>
}

export function CreateBot(dependencies: BotDependencies): BotLifecycle {
  const client = new Client({
    intents: dependencies.intents ?? [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  })

  client.once(Events.ClientReady, () => {
    dependencies.logger.Info('Bot is ready', { tag: client.user?.tag })
  })

  return {
    client,
    Start: async (token: string) => {
      dependencies.logger.Info('Starting bot login')
      await client.login(token)
      dependencies.logger.Info('Bot login successful')
    }
  }
}

