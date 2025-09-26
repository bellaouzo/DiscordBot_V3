import { ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { ResponseResult, ResponderMessageOptions, ConvertToInteractionFlags } from './ResponseTypes'
import { Logger } from '../Shared/Logger'

export class DeferResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: ChatInputCommandInteraction, options: ResponderMessageOptions | boolean = false): Promise<ResponseResult> {
    try {
      const flags = typeof options === 'boolean' 
        ? (options ? MessageFlags.Ephemeral : undefined)
        : ConvertToInteractionFlags(options)
        
      await interaction.deferReply({
        flags: flags
      })

      return { success: true, message: 'Deferred' }
    } catch (error) {
      this.logger.Error('Defer failed', { error })
      return { success: false, message: 'Failed to defer' }
    }
  }
}

