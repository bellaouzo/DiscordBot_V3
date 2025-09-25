import { ChatInputCommandInteraction } from 'discord.js'
import { ResponseOptions, ResponseResult, ConvertToInteractionFlags } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class FollowUpResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: ChatInputCommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    try {
      await interaction.followUp({
        content: options.content,
        flags: ConvertToInteractionFlags(options),
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

