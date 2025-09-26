import { ChatInputCommandInteraction } from 'discord.js'
import { ResponseOptions, ResponseResult, ConvertToInteractionFlags } from './ResponseTypes'
import { Logger } from '../Shared/Logger'

export class ReplyResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: ChatInputCommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return { success: false, message: 'Already replied to this interaction' }
    }

    try {
      await interaction.reply({
        content: options.content,
        flags: ConvertToInteractionFlags(options),
        components: options.components,
        embeds: options.embeds,
        files: options.files
      })

      return { success: true, message: 'Reply sent' }
    } catch (error) {
      this.logger.Error('Reply failed', { error })
      return { success: false, message: 'Failed to reply' }
    }
  }
}

