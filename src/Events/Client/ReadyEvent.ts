import { Events } from 'discord.js'
import { CreateEvent } from '../EventFactory'

export const ReadyEvent = CreateEvent({
  name: Events.ClientReady,
  once: true,
  execute: async context => {
    const user = context.client.user
    context.logger.Info('Client ready', {
      tag: user?.tag,
      id: user?.id
    })
  }
})