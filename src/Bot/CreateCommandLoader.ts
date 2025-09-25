import { SlashCommandBuilder } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import { CommandDefinition } from '../Commands/CommandFactory'
import { Logger } from '../Logging/Logger'

export interface CommandLoaderResult {
  readonly commands: SlashCommandBuilder[]
  readonly modules: Map<string, CommandDefinition>
}

export type CommandLoader = () => Promise<CommandLoaderResult>

export function CreateCommandLoader(logger: Logger): CommandLoader {
  return async () => {
    const commands: SlashCommandBuilder[] = []
    const commandModules = new Map<string, CommandDefinition>()

    // Auto-discover commands from compiled JS files
    const commandsPath = join(__dirname, '..', 'Commands')
    const commandFiles = readdirSync(commandsPath, { recursive: true })
      .filter(file => typeof file === 'string' && file.endsWith('.js') && !file.includes('index.js') && !file.includes('registry.js') && !file.includes('CommandFactory.js') && !file.includes('CommandOptions.js'))

    for (const file of commandFiles) {
      try {
        const modulePath = join(commandsPath, file as string)
        const module = await import(modulePath)
        
        // Look for exported command definitions
        const commandExports = Object.values(module).filter(exp => 
          exp && typeof exp === 'object' && 'data' in exp && 'execute' in exp && 'group' in exp
        ) as CommandDefinition[]

        for (const command of commandExports) {
          commands.push(command.data)
          commandModules.set(command.data.name, command)
        }
      } catch (error) {
        logger.Error('Failed to load command file', { file: String(file), error })
      }
    }

    logger.Debug('Auto loaded all commands', { timestamp: new Date().toISOString() })

    return { commands, modules: commandModules }
  }
}

