import { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js'
import { CommandContext, CreateCommand } from '../CommandFactory'
import { LoggingMiddleware } from '../Middleware/LoggingMiddleware'
import { ErrorMiddleware } from '../Middleware/ErrorMiddleware'
import { Config } from '../Middleware/CommandConfig'
import { PaginationPage } from '../../Pagination'
import { AllCommands } from '../registry'
import { EmbedFactory, ComponentFactory } from '../../Utilities'

interface CommandInfo {
  readonly name: string
  readonly description: string
  readonly group: string
}

interface HelpSection {
  readonly name: string
  readonly description: string
  readonly commands: CommandInfo[]
  readonly icon: string
  readonly color: number
}

// Cache for expensive operations
const commandCache = new Map<string, { data: CommandInfo[], timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

async function ExecuteHelp(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void> {
  const { paginatedResponder, componentRouter } = context.responders
  const { logger } = context

  try {
    const allCommands = await GetAllCommandsCached()
    const sections = GroupCommandsBySection(allCommands)

    // Create optimized pages
    const pages = CreateOptimizedPages(sections)

    // Register optimized button handlers
    RegisterOptimizedButtons(sections, componentRouter, interaction.id, interaction.user.id)

    await paginatedResponder.Send({
      interaction,
      pages,
      ephemeral: true,
      ownerId: interaction.user.id,
      timeoutMs: 1000 * 60 * 5
    })

    logger.Info('Help command executed', { 
      extra: { 
        userId: interaction.user.id,
        commandCount: allCommands.length,
        sectionCount: sections.length
      } 
    })
  } catch (error) {
    logger.Error('Help command failed', { error })
    throw error
  }
}

async function GetAllCommandsCached(): Promise<CommandInfo[]> {
  const cacheKey = 'all-commands'
  const cached = commandCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  const commands = AllCommands().map(cmd => ({
    name: cmd.data.name,
    description: cmd.data.description,
    group: cmd.group
  }))

  commandCache.set(cacheKey, { data: commands, timestamp: Date.now() })
  return commands
}

function GroupCommandsBySection(commands: CommandInfo[]): HelpSection[] {
  const groups = new Map<string, CommandInfo[]>()

  for (const command of commands) {
    const group = command.group
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)!.push(command)
  }

  return Array.from(groups.entries()).map(([name, commands]) => ({
    name: FormatGroupName(name),
    description: GetGroupDescription(name),
    commands,
    icon: GetGroupIcon(name),
    color: GetGroupColor(name)
  }))
}

function CreateOptimizedPages(sections: HelpSection[]): PaginationPage[] {
  // Create overview page
  const overviewPage: PaginationPage = {
    content: '📚 **Help Menu** - Use the buttons below to navigate between sections',
    embeds: [CreateOverviewEmbed(sections).toJSON()]
  }

  // Create section pages
  const sectionPages: PaginationPage[] = sections.map(section => ({
    embeds: [CreateSectionEmbed(section).toJSON()]
  }))

  return [overviewPage, ...sectionPages]
}

function CreateOverviewEmbed(sections: HelpSection[]) {
  const totalCommands = sections.reduce((sum, section) => sum + section.commands.length, 0)
  
  const embed = EmbedFactory.CreateHelpOverview(totalCommands, sections.length)

  // Add section fields
  sections.forEach(section => {
    embed.addFields({
      name: `${section.icon} ${section.name}`,
      value: `${section.description}\n**${section.commands.length} command${section.commands.length !== 1 ? 's' : ''} available**`,
      inline: true
    })
  })

  // Add usage instructions
  embed.addFields({
    name: '📖 How to Use',
    value: '• **Navigation buttons**: Jump between categories\n• **Pagination controls**: Navigate through pages\n• **Stop button**: Close the help menu',
    inline: false
  })

  return embed
}

function CreateSectionEmbed(section: HelpSection) {
  const embed = EmbedFactory.CreateHelpSection(section.name, section.description, section.commands.length)

  if (section.commands.length === 0) {
    embed.addFields({
      name: '🚫 No Commands',
      value: 'This section currently has no available commands.',
      inline: false
    })
  } else {
    // Chunk commands to avoid embed limits
    const chunks = ChunkArray(section.commands, 8)
    
    chunks.forEach((chunk, index) => {
      const commandList = chunk
        .map(cmd => `\`/${cmd.name}\`\n${cmd.description}`)
        .join('\n\n')
      
      embed.addFields({
        name: index === 0 ? '📋 Available Commands' : '📋 Commands (continued)',
        value: commandList,
        inline: false
      })
    })
  }

  return embed
}

function RegisterOptimizedButtons(
  sections: HelpSection[],
  componentRouter: any,
  interactionId: string,
  ownerId: string
): void {
  // Register overview button
  componentRouter.RegisterButton({
    customId: `help:${interactionId}:section:-1`,
    ownerId,
    handler: CreateButtonHandler(sections, -1),
    expiresInMs: 1000 * 60 * 5
  })

  // Register section buttons
  sections.forEach((_, index) => {
    componentRouter.RegisterButton({
      customId: `help:${interactionId}:section:${index}`,
      ownerId,
      handler: CreateButtonHandler(sections, index),
      expiresInMs: 1000 * 60 * 5
    })
  })
}

function CreateButtonHandler(sections: HelpSection[], sectionIndex: number) {
  return async (buttonInteraction: ButtonInteraction) => {
    await buttonInteraction.deferUpdate()
    
    const embed = sectionIndex === -1 
      ? CreateOverviewEmbed(sections)
      : CreateSectionEmbed(sections[sectionIndex])
    
    const components = ComponentFactory.CreateHelpSectionButtons(
      [{ name: 'Overview' }, ...sections], 
      buttonInteraction.id,
      sectionIndex
    ).map(row => row.toJSON())

    await buttonInteraction.editReply({
      embeds: [embed.toJSON()],
      components
    })
  }
}

// Utility functions
function FormatGroupName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1)
}

function GetGroupDescription(group: string): string {
  const descriptions: Record<string, string> = {
    utility: '🔧 General utility commands for everyday use',
    moderation: '🛡️ Commands for moderating the server',
    admin: '⚙️ Administrative commands for server management',
    fun: '🎮 Fun and entertainment commands',
    info: '📊 Information and lookup commands',
    music: '🎵 Music and audio commands',
    economy: '💰 Economy and currency commands',
    games: '🎲 Gaming and interactive commands'
  }
  return descriptions[group] ?? '📦 Commands for this category'
}

function GetGroupIcon(group: string): string {
  const icons: Record<string, string> = {
    utility: '🔧',
    moderation: '🛡️',
    admin: '⚙️',
    fun: '🎮',
    info: '📊',
    music: '🎵',
    economy: '💰',
    games: '🎲'
  }
  return icons[group] ?? '📦'
}

function GetGroupColor(group: string): number {
  const colors: Record<string, number> = {
    utility: 0x5865F2,
    moderation: 0xED4245,
    admin: 0xFEE75C,
    fun: 0x57F287,
    info: 0xEB459E,
    music: 0x1ABC9C,
    economy: 0xFFD700,
    games: 0x9B59B6
  }
  return colors[group] ?? 0x5865F2
}

function ChunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export const HelpCommand = CreateCommand({
  name: 'help',
  description: '📚 Browse all available bot commands with an interactive menu',
  group: 'utility',
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware]
  },
  config: Config.utility(0),
  execute: ExecuteHelp
})
