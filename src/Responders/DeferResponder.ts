import { ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { ResponseResult } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class DeferResponder {
  constructor(private readonly logger: Logger) {}

  async Send(interaction: ChatInputCommandInteraction, ephemeral = false): Promise<ResponseResult> {
    try {
      await interaction.deferReply({
        flags: ephemeral ? [MessageFlags.Ephemeral] : undefined
      })

      return { success: true, message: 'Deferred' }
    } catch (error) {
      this.logger.Error('Defer failed', { error })
      return { success: false, message: 'Failed to defer' }
    }
  }
}

