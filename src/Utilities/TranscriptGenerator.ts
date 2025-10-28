import { Ticket, TicketMessage } from '../Database'
import { Guild, User } from 'discord.js'

export interface GenerateTranscriptOptions {
  readonly ticket: Ticket
  readonly messages: TicketMessage[]
  readonly user: User
  readonly guild: Guild
}

export class TranscriptGenerator {
  static Generate(options: GenerateTranscriptOptions): string {
    const { ticket, messages, user, guild } = options

    const createdAt = new Date(ticket.created_at).toISOString()
    const closedAt = ticket.closed_at ? new Date(ticket.closed_at).toISOString() : 'N/A'
    const claimedBy = ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'None'

    let transcript = '='.repeat(80) + '\n'
    transcript += `TICKET TRANSCRIPT\n`
    transcript += '='.repeat(80) + '\n\n'

    transcript += `Ticket ID: ${ticket.id}\n`
    transcript += `User: ${user.tag} (${user.id})\n`
    transcript += `Guild: ${guild.name} (${guild.id})\n`
    transcript += `Category: ${ticket.category}\n`
    transcript += `Status: ${ticket.status}\n`
    transcript += `Claimed by: ${claimedBy}\n`
    transcript += `Created: ${createdAt}\n`
    transcript += `Closed: ${closedAt}\n`
    transcript += '\n' + '='.repeat(80) + '\n\n'
    transcript += 'CONVERSATION LOG\n'
    transcript += '='.repeat(80) + '\n\n'

    if (messages.length === 0) {
      transcript += 'No messages were logged.\n'
    } else {
      for (const message of messages) {
        const timestamp = new Date(message.timestamp).toISOString()
        transcript += `[${timestamp}] <@${message.user_id}>\n`
        transcript += `${message.content}\n\n`
      }
    }

    transcript += '\n' + '='.repeat(80) + '\n'
    transcript += 'END OF TRANSCRIPT\n'
    transcript += '='.repeat(80) + '\n'

    return transcript
  }

  static GenerateFileName(ticket: Ticket): string {
    const timestamp = new Date(ticket.closed_at || Date.now()).toISOString().split('T')[0]
    return `ticket-${ticket.id}-${timestamp}.txt`
  }
}

