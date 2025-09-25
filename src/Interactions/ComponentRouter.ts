import { randomUUID } from 'crypto'
import { ButtonInteraction, InteractionReplyOptions } from 'discord.js'
import { Logger } from '../Logging/Logger'

export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void> | void

export interface RegisterButtonOptions {
  readonly customId?: string
  readonly handler: ButtonHandler
  readonly ownerId?: string
  readonly expiresInMs?: number
  readonly singleUse?: boolean
  readonly onExpire?: () => void
}

interface ButtonRegistration {
  readonly handler: ButtonHandler
  readonly ownerId?: string
  readonly expiresAt?: number
  readonly singleUse: boolean
  readonly onExpire?: () => void
}

export interface RegisteredButton {
  readonly customId: string
  readonly dispose: () => void
}

export class ComponentRouter {
  private readonly buttons = new Map<string, ButtonRegistration>()

  constructor(private readonly logger: Logger) {}

  RegisterButton(options: RegisterButtonOptions): RegisteredButton {
    const customId = options.customId ?? randomUUID()
    const expiresAt = options.expiresInMs ? Date.now() + options.expiresInMs : undefined

    this.buttons.set(customId, {
      handler: options.handler,
      ownerId: options.ownerId,
      expiresAt,
      singleUse: options.singleUse ?? false,
      onExpire: options.onExpire
    })

    return {
      customId,
      dispose: () => {
        const registration = this.buttons.get(customId)
        if (!registration) {
          return
        }
        this.buttons.delete(customId)
        registration.onExpire?.()
      }
    }
  }

  async HandleButton(interaction: ButtonInteraction): Promise<boolean> {
    const registration = this.buttons.get(interaction.customId)

    if (!registration) {
      return false
    }

    const now = Date.now()
    if (registration.expiresAt && now > registration.expiresAt) {
      this.buttons.delete(interaction.customId)
      registration.onExpire?.()
      await this.ReplyIfNeeded(interaction, {
        content: 'This interaction has expired.',
        ephemeral: true
      })
      return true
    }

    if (registration.ownerId && registration.ownerId !== interaction.user.id) {
      await this.ReplyIfNeeded(interaction, {
        content: 'You cannot use this interaction.',
        ephemeral: true
      })
      return true
    }

    try {
      await registration.handler(interaction)
    } catch (error) {
      this.logger.Error('Button handler failed', {
        extra: {
          customId: interaction.customId
        },
        error
      })

      await this.ReplyIfNeeded(interaction, {
        content: 'Something went wrong while handling that interaction.',
        ephemeral: true
      })
    }

    if (registration.singleUse) {
      this.buttons.delete(interaction.customId)
      registration.onExpire?.()
    }

    return true
  }

  private async ReplyIfNeeded(interaction: ButtonInteraction, options: InteractionReplyOptions): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      return
    }

    await interaction.reply(options)
  }
}

export function CreateComponentRouter(logger: Logger): ComponentRouter {
  return new ComponentRouter(logger)
}