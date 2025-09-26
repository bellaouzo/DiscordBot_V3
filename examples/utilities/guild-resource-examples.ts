import { SlashCommandBuilder } from 'discord.js'
import { CreateCommand } from '../../src/Commands/CommandFactory'
import { CreateGuildResourceLocator } from '../../src/Utilities'

async function ExecuteGuildResources(interaction: any, context: any): Promise<void> {
  const { replyResponder } = context.responders
  const { logger } = context

  if (!interaction.guild) {
    await replyResponder.Send(interaction, {
      content: '❌ This command requires a guild context.',
      ephemeral: true
    })
    return
  }

  try {
    // Create a guild resource locator for easy access to guild resources
    const locator = CreateGuildResourceLocator({
      guild: interaction.guild,
      logger,
      cacheTtlMs: 120_000 // Cache for 2 minutes
    })

    // Get channels by ID or name
    const channels = [
      await locator.GetChannelByName('general'),
      await locator.GetTextChannel(interaction.channelId),
      await locator.GetChannelByName('announcements')
    ].filter(Boolean)

    // Get roles by name
    const adminRole = await locator.GetRoleByName('admin')
    const moderatorRole = await locator.GetRoleByName('moderator')

    // Get members
    const member = await locator.GetMember(interaction.user.id)

    // Create embed with resource information
    const content = `📊 **Guild Resources Found**\n\n**Channels:** ${channels.length} found\n**Roles:** ${[adminRole, moderatorRole].filter(Boolean).length} found\n**Current Member:** ${member ? 'Found' : 'Not found'}`

    await replyResponder.Send(interaction, {
      content,
      ephemeral: true
    })

  } catch (error) {
    logger.Error('Failed to gather guild resources', {
      guildId: interaction.guild?.id,
      userId: interaction.user.id,
      error
    })

    await replyResponder.Send(interaction, {
      content: '❌ Failed to gather guild resources.',
      ephemeral: true
    })
  }
}

export const GuildResourceExample = CreateCommand({
  name: 'guild-resources',
  description: 'Find channels, roles, and members in the current guild',
  group: 'utility',
  execute: ExecuteGuildResources
})
