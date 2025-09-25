import { EditResponder } from './EditResponder'
import { ReplyResponder } from './ReplyResponder'
import { ResponseActionOptions } from './ResponseTypes'
import { Logger } from '../Logging/Logger'

export class ActionResponder {
  constructor(
    private readonly replyResponder: ReplyResponder,
    private readonly editResponder: EditResponder,
    private readonly logger: Logger
  ) {}

  async Send(options: ResponseActionOptions): Promise<void> {
    await this.replyResponder.Send(options.interaction, { content: options.message })

    try {
      await options.action()
      if (options.followUp) {
        await this.editResponder.Send(options.interaction, { content: options.followUp })
      }
    } catch (error) {
      this.logger.Error('Action failed', { error })
      const finalError = options.error ?? 'Action failed'
      await this.editResponder.Send(options.interaction, { content: finalError })
    }
  }
}

