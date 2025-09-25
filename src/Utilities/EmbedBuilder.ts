import { EmbedBuilder, ColorResolvable } from 'discord.js'

export interface EmbedOptions {
  readonly title?: string
  readonly description?: string
  readonly color?: ColorResolvable
  readonly footer?: string
  readonly timestamp?: boolean
  readonly thumbnail?: string
  readonly image?: string
}

export interface FieldOptions {
  readonly name: string
  readonly value: string
  readonly inline?: boolean
}

export class EmbedFactory {
  private static readonly DEFAULT_COLOR = 0x5865F2
  private static readonly SUCCESS_COLOR = 0x57F287
  private static readonly WARNING_COLOR = 0xFEE75C
  private static readonly ERROR_COLOR = 0xED4245

  static Create(options: EmbedOptions = {}): EmbedBuilder {
    const embed = new EmbedBuilder()

    if (options.title) embed.setTitle(options.title)
    if (options.description) embed.setDescription(options.description)
    if (options.thumbnail) embed.setThumbnail(options.thumbnail)
    if (options.image) embed.setImage(options.image)

    embed.setColor(options.color ?? this.DEFAULT_COLOR)
    
    if (options.timestamp !== false) embed.setTimestamp()
    if (options.footer) embed.setFooter({ text: options.footer })

    return embed
  }

  static CreateSuccess(options: Omit<EmbedOptions, 'color'>): EmbedBuilder {
    return this.Create({ ...options, color: this.SUCCESS_COLOR })
  }

  static CreateWarning(options: Omit<EmbedOptions, 'color'>): EmbedBuilder {
    return this.Create({ ...options, color: this.WARNING_COLOR })
  }

  static CreateError(options: Omit<EmbedOptions, 'color'>): EmbedBuilder {
    return this.Create({ ...options, color: this.ERROR_COLOR })
  }

  static CreateHelpSection(sectionName: string, description: string, commandCount: number): EmbedBuilder {
    return this.Create({
      title: `📁 ${sectionName} Commands`,
      description,
      footer: `${commandCount} command${commandCount !== 1 ? 's' : ''} available`,
      color: this.GetSectionColor(sectionName)
    })
  }

  static CreateHelpOverview(totalCommands: number, categoryCount: number): EmbedBuilder {
    return this.Create({
      title: '🤖 Bot Command Overview',
      description: 'Welcome to the help menu! Use the buttons below to navigate between different command categories.',
      footer: `Total: ${totalCommands} commands across ${categoryCount} categories`,
      color: this.DEFAULT_COLOR
    })
  }

  private static GetSectionColor(sectionName: string): ColorResolvable {
    const colors: Record<string, ColorResolvable> = {
      'Utility': 0x5865F2,
      'Moderation': 0xED4245,
      'Admin': 0xFEE75C,
      'Fun': 0x57F287,
      'Info': 0xEB459E,
      'Music': 0x1ABC9C,
      'Economy': 0xFFD700,
      'Games': 0x9B59B6
    }
    return colors[sectionName] ?? this.DEFAULT_COLOR
  }
}
