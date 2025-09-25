import { CommandInteraction } from 'discord.js'
import { ResponseOptions, ResponseResult } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class EditResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    if (!interaction.replied) {
      return { success: false, message: 'No reply to edit' }
    }

    try {
      await interaction.editReply({
        content: options.content,
        components: options.components,
        embeds: options.embeds,
        files: options.files
      })

      return { success: true, message: 'Reply edited' }
    } catch (error) {
      this.logger.Error('Edit failed', { error })
      return { success: false, message: 'Failed to edit' }
    }
  }
}

