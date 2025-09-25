import { CommandInteraction, MessageFlags } from 'discord.js'
import { ResponseOptions, ResponseResult } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class ReplyResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    if (interaction.replied || interaction.deferred) {
      return { success: false, message: 'Already replied to this interaction' }
    }

    try {
      await interaction.reply({
        content: options.content,
        flags: options.ephemeral ? [MessageFlags.Ephemeral] : undefined,
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

