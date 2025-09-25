import 'dotenv/config'
import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'

interface CommandModule {
  CommandInfo: {
    name: string
    description: string
    data: SlashCommandBuilder
  }
  Execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

async function LoadCommands(): Promise<{ commands: SlashCommandBuilder[], commandModules: Map<string, CommandModule> }> {
  const commands: SlashCommandBuilder[] = []
  const commandModules = new Map<string, CommandModule>()
  
  const commandFiles = readdirSync(join(__dirname, 'Commands'))
    .filter(file => file.endsWith('.js'))
  
  for (const file of commandFiles) {
    try {
      const command = await import(join(__dirname, 'Commands', file)) as CommandModule
      
      if (!command.CommandInfo || typeof command.Execute !== 'function') continue
      
      commands.push(command.CommandInfo.data)
      commandModules.set(command.CommandInfo.name, command)
      console.log(`Loaded command: ${command.CommandInfo.name}`)
    } catch (error) {
      console.error(`Failed to load command from ${file}:`, error)
    }
  }
  
  return { commands, commandModules }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
})

let commands: SlashCommandBuilder[] = []
let commandModules: Map<string, CommandModule> = new Map()

client.once(Events.ClientReady, () => {
  console.log(`Bot is ready! Logged in as ${client.user?.tag}`)
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  
  const command = commandModules.get(interaction.commandName)
  if (!command) return
  
  await command.Execute(interaction)
})

async function deployCommands() {
  if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.log('Missing CLIENT_ID or GUILD_ID in environment variables')
    return
  }

  console.log('Started refreshing application (/) commands.')
  
  try {
    await new REST().setToken(process.env.DISCORD_TOKEN!).put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    )
    console.log('Successfully reloaded application (/) commands.')
  } catch (error) {
    console.error('Failed to deploy commands:', error)
  }
}

async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is not set in the environment variables.')
    return
  }

  const { commands: loadedCommands, commandModules: loadedModules } = await LoadCommands()
  commands = loadedCommands
  commandModules = loadedModules
  
  await deployCommands()
  await client.login(process.env.DISCORD_TOKEN)
}

startBot()
