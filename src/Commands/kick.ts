import { ChatInputCommandInteraction } from 'discord.js'
import { ResponseUtils, CreateCommand } from '../Utilities'

async function Execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('KickMembers')) {
    await ResponseUtils.Error(interaction, 'You do not have permission to kick members.')
    return
  }

  const targetUser = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason') ?? 'No reason provided'
  const notify = interaction.options.getBoolean('notify') ?? false

  await ResponseUtils.Action(interaction, {
    message: `Kicking ${targetUser.username}...`,
    followUp: `✅ Successfully kicked **${targetUser.username}** for: ${reason}`,
    action: async () => {
      const targetMember = await interaction.guild?.members.fetch(targetUser.id)
      const dmMessage = `You have been kicked from ${interaction.guild?.name} for: ${reason}`

      if (!targetMember) throw new Error('User not found in this server.')
      if (!targetMember.kickable) throw new Error('I cannot kick this user. They may have higher permissions than me.')

      await targetMember.kick(reason)

      if (notify) {
        // DmUser will return false on failure and log it, but we won't interrupt the flow.
        await ResponseUtils.DmUser(targetUser, dmMessage)
      }
    }
  })
}

export default CreateCommand('kick', 'Kick a user from the server')
  .AddUserOption('user', 'The user to kick', true)
  .AddStringOption('reason', 'Reason for kicking', true)
  .AddBooleanOption('notify', 'Send DM notification to user', false)
  .SetExecute(Execute)
