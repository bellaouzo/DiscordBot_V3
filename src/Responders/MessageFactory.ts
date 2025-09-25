import { EmbedBuilder } from 'discord.js'
import { ResponseOptions } from './ResponseTypes'

interface ErrorMessageOptions {
  readonly title: string
  readonly description: string
  readonly hint?: string
}

const ERROR_COLOR = 0xff4444

export function CreateErrorMessage(options: ErrorMessageOptions): ResponseOptions {
  const embed = new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle(options.title)
    .setDescription(options.description)
    .setTimestamp()

  if (options.hint) {
    embed.setFooter({ text: options.hint })
  }

  return {
    embeds: [embed]
  }
}
