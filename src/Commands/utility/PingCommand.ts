import { ChatInputCommandInteraction } from 'discord.js'
import { CommandContext, CreateCommand } from '../CommandFactory'
import { LoggingMiddleware } from '../Middleware/LoggingMiddleware'
import { CooldownMiddleware } from '../Middleware/CooldownMiddleware'
import { ErrorMiddleware } from '../Middleware/ErrorMiddleware'
import { Config } from '../Middleware/CommandConfig'
import { EmbedFactory } from '../../Utilities/EmbedBuilder'

async function ExecutePing(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void> {
  const { interactionResponder } = context.responders

  const initialEmbed = EmbedFactory.Create({
    title: '🏓 Pong!',
    description: 'Checking bot latency...',
    color: 0x57F287,
    footer: 'Discord Bot V3'
  })

  await interactionResponder.Reply(interaction, { ephemeral: true, embeds: [initialEmbed] })
  const latency = Date.now() - interaction.createdTimestamp
  
  const responseEmbed = EmbedFactory.Create({
    title: '🏓 Pong!',
    description: 'Here\'s the current latency information:',
    color: latency < 100 ? 0x57F287 : latency < 200 ? 0xFEE75C : 0xED4245,
    footer: 'Discord Bot V3'
  })

  responseEmbed.addFields(
    {
      name: '📡 Bot Latency',
      value: `${latency}ms`,
      inline: true
    },
    {
      name: '⚡ Status',
      value: latency < 100 ? 'Excellent' : latency < 200 ? 'Good' : 'Fair',
      inline: true
    }
  )

  await interactionResponder.Edit(interaction, { embeds: [responseEmbed] })
}

export const PingCommand = CreateCommand({
  name: 'ping',
  description: 'Replies with Pong!',
  group: 'utility',
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(1),
  execute: ExecutePing
})