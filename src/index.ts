import { CreateBot } from './Bot/CreateBot'
import { CreateCommandDeployer } from './Bot/CreateCommandDeployer'
import { CreateCommandLoader } from './Bot/CreateCommandLoader'
import { CreateCommandExecutor } from './Bot/ExecuteCommand'
import { LoadAppConfig } from './Config/AppConfig'
import { CreateConsoleLogger } from './Logging/Logger'
import { CreateResponders } from './Responders'

async function Bootstrap(): Promise<void> {
  const config = LoadAppConfig()
  const logger = CreateConsoleLogger()
  const responders = CreateResponders({ logger })
  const bot = CreateBot({ logger })
  const loadCommands = CreateCommandLoader(logger)
  const deployCommands = CreateCommandDeployer({ deployment: config.deployment, token: config.discord.token, logger })
  const executeCommand = CreateCommandExecutor(logger)

  const { commands, modules } = await loadCommands()

  bot.client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) {
      return
    }
    
    const command = modules.get(interaction.commandName)
    if (!command) {
      return
    }
    await executeCommand(command, interaction, responders)
  })

  await deployCommands(commands)
  await bot.Start(config.discord.token)
}

Bootstrap().catch(error => {
  CreateConsoleLogger().Error('Failed to start bot', { error })
})
 
