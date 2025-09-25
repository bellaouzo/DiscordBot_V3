import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js'

export interface ButtonOptions {
  readonly label: string
  readonly style?: ButtonStyle
  readonly emoji?: string
  readonly disabled?: boolean
}

export interface ActionRowOptions {
  readonly buttons: ButtonOptions[]
  readonly customIds: string[]
}

export class ComponentFactory {
  static CreateButton(options: ButtonOptions & { customId: string }): ButtonBuilder {
    const button = new ButtonBuilder()
      .setLabel(options.label)
      .setStyle(options.style ?? ButtonStyle.Secondary)
      .setCustomId(options.customId)
      .setDisabled(options.disabled ?? false)

    if (options.emoji) {
      button.setEmoji(options.emoji)
    }

    return button
  }

  static CreateActionRow(options: ActionRowOptions): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>()
    
    options.buttons.forEach((buttonOpts, index) => {
      const button = this.CreateButton({
        ...buttonOpts,
        customId: options.customIds[index]
      })
      row.addComponents(button)
    })

    return row
  }

  static CreateHelpSectionButtons(
    sections: Array<{ name: string }>,
    interactionId: string,
    currentIndex = -1
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    
    // Create overview button
    const overviewButton = this.CreateButton({
      label: 'Overview',
      style: currentIndex === -1 ? ButtonStyle.Primary : ButtonStyle.Secondary,
      emoji: '🏠',
      customId: `help:${interactionId}:section:-1`
    })

    // Create section buttons
    const sectionButtons = sections.map((section, index) => 
      this.CreateButton({
        label: section.name,
        style: currentIndex === index ? ButtonStyle.Primary : ButtonStyle.Secondary,
        customId: `help:${interactionId}:section:${index}`
      })
    )

    // Combine overview and sections (max 5 per row)
    const allButtons = [overviewButton, ...sectionButtons]
    
    for (let i = 0; i < allButtons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>()
      row.addComponents(...allButtons.slice(i, i + 5))
      rows.push(row)
    }

    return rows
  }

  static CreatePaginationButtons(
    currentIndex: number,
    totalPages: number,
    interactionId: string
  ): ActionRowBuilder<ButtonBuilder> {
    const isFirst = currentIndex === 0
    const isLast = currentIndex === totalPages - 1

    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        this.CreateButton({
          label: '⏮',
          style: ButtonStyle.Secondary,
          customId: `page:${interactionId}:first`,
          disabled: isFirst
        }),
        this.CreateButton({
          label: '◀',
          style: ButtonStyle.Secondary,
          customId: `page:${interactionId}:prev`,
          disabled: isFirst
        }),
        this.CreateButton({
          label: `${currentIndex + 1}/${totalPages}`,
          style: ButtonStyle.Secondary,
          customId: `page:${interactionId}:current`,
          disabled: true
        }),
        this.CreateButton({
          label: '▶',
          style: ButtonStyle.Secondary,
          customId: `page:${interactionId}:next`,
          disabled: isLast
        }),
        this.CreateButton({
          label: '⏹',
          style: ButtonStyle.Danger,
          customId: `page:${interactionId}:stop`
        })
      )
  }
}
