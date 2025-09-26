import { User } from 'discord.js'
import { Logger } from '../Shared/Logger'

export class DmResponder {
  constructor(private readonly logger: Logger) {}

  async Send(user: User, message: string): Promise<boolean> {
    try {
      await user.send(message)
      return true
    } catch (error) {
      this.logger.Error('DM failed', { error })
      return false
    }
  }
}

