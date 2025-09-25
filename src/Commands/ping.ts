import { ChatInputCommandInteraction } from 'discord.js'
import { ResponseUtils, CreateCommand } from '../Utilities'

async function Execute(interaction: ChatInputCommandInteraction) {
  await ResponseUtils.Action(interaction, {
    action: async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100))
    },
    message: 'Pinging...',
    followUp: `Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`
  })
}

export default CreateCommand('ping', 'Replies with Pong!').SetExecute(Execute)
