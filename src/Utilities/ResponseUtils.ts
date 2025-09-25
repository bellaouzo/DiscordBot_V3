import { CommandInteraction, MessageFlags, User } from 'discord.js'

export interface ResponseOptions {
  content?: string
  ephemeral?: boolean
  components?: any[]
  embeds?: any[]
  files?: any[]
}

export interface ResponseResult {
  success: boolean
  message?: string
}

export class ResponseUtils {
  /**
   * Send initial reply to interaction
   */
  static async Reply(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    try {
      if (interaction.replied || interaction.deferred) {
        return { success: false, message: 'Already replied to this interaction' }
      }

      await interaction.reply({
        content: options.content,
        flags: options.ephemeral ? [MessageFlags.Ephemeral] : undefined,
        components: options.components,
        embeds: options.embeds,
        files: options.files
      })
      
      return { success: true, message: 'Reply sent' }
    } catch (error) {
      console.error('Reply error:', error)
      return { success: false, message: `Failed to reply: ${error}` }
    }
  }

  /**
   * Edit existing reply
   */
  static async Edit(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
    try {
      if (!interaction.replied) {
        return { success: false, message: 'No reply to edit' }
      }

      await interaction.editReply({
        content: options.content,
        components: options.components,
        embeds: options.embeds,
        files: options.files
      })
      
      return { success: true, message: 'Reply edited' }
    } catch (error) {
      console.error('Edit error:', error)
      return { success: false, message: `Failed to edit: ${error}` }
    }
  }

  /**
   * Send follow-up message
   */
  static async FollowUp(interaction: CommandInteraction, options: ResponseOptions): Promise<ResponseResult> {
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
      console.error('Follow-up error:', error)
      return { success: false, message: `Failed to send follow-up: ${error}` }
    }
  }

  /**
   * Quick success reply
   */
  static async Success(interaction: CommandInteraction, content: string, ephemeral = false) {
    return this.Reply(interaction, { content, ephemeral })
  }

  /**
   * Quick error reply
   */
  static async Error(interaction: CommandInteraction, content: string, ephemeral = true) {
    return this.Reply(interaction, { content, ephemeral })
  }

  /**
   * Defer reply for long operations
   */
  static async Defer(interaction: CommandInteraction, ephemeral = false) {
    try {
      await interaction.deferReply({
        flags: ephemeral ? [MessageFlags.Ephemeral] : undefined
      })
      
      return { success: true, message: 'Deferred' }
    } catch (error) {
      console.error('Defer error:', error)
      return { success: false, message: `Failed to defer: ${error}` }
    }
  }

  // Action helpers that combine common patterns
  static async Action(
    interaction: CommandInteraction,
    options: {
      action: () => Promise<void>
      message: string
      followUp?: string
      error?: string
    }
  ) {
    await this.Reply(interaction, { content: options.message })
    
    try {
      await options.action()
      if (options.followUp) {
        await this.Edit(interaction, { content: options.followUp })
      }
    } catch (error) {
      console.error('Action failed:', error)
      const finalError = options.error || `Action failed: ${error}`
      await this.Edit(interaction, { content: finalError })
    }
  }

  /**
   * Send DM to user with automatic error handling
   */
  static async DmUser(user: User, message: string): Promise<boolean> {
    try {
      await user.send(message)
      return true
    } catch (error) {
      console.log(`Could not send DM to ${user.username}: ${error}`)
      return false
    }
  }
}
