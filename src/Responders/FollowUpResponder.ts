import { CommandInteraction, MessageFlags } from 'discord.js'
import { ResponseOptions, ResponseResult } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class FollowUpResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    try {
      await interaction.followUp({
        content: options.content,
        flags: options.ephemeral ? [MessageFlags.Ephemeral] : undefined,
        components: options.components,
        embeds: options.embeds,
        files: options.files
      })

      return { success: true, message: 'Follow-up sent' }
    } catch (error) {
      this.logger.Error('Follow-up failed', { error })
      return { success: false, message: 'Failed to send follow-up' }
    }
  }
}

