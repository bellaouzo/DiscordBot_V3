import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export class CommandBuilder extends SlashCommandBuilder {
  public execute: (interaction: ChatInputCommandInteraction) => Promise<void>

  constructor(name: string, description: string) {
    super()
    this.setName(name)
    this.setDescription(description)
  }

  SetExecute(execute: (interaction: ChatInputCommandInteraction) => Promise<void>): this {
    this.execute = execute
    return this
  }

  // String options
  AddStringOption(name: string, description: string, required = false): this {
    this.addStringOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  AddStringOptionWithChoices(name: string, description: string, choices: { name: string; value: string }[], required = false): this {
    this.addStringOption(option =>
      option
        .setName(name)
        .setDescription(description)
        .setRequired(required)
        .addChoices(...choices)
    )
    return this
  }

  AddStringOptionWithAutocomplete(name: string, description: string, required = false): this {
    this.addStringOption(option =>
      option
        .setName(name)
        .setDescription(description)
        .setRequired(required)
        .setAutocomplete(true)
    )
    return this
  }

  // Number options
  AddNumberOption(name: string, description: string, required = false): this {
    this.addNumberOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  AddNumberOptionWithRange(name: string, description: string, min: number, max: number, required = false): this {
    this.addNumberOption(option =>
      option
        .setName(name)
        .setDescription(description)
        .setRequired(required)
        .setMinValue(min)
        .setMaxValue(max)
    )
    return this
  }

  // User options
  AddUserOption(name: string, description: string, required = false): this {
    this.addUserOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  // Channel options
  AddChannelOption(name: string, description: string, required = false): this {
    this.addChannelOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  // Role options
  AddRoleOption(name: string, description: string, required = false): this {
    this.addRoleOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  // Boolean options
  AddBooleanOption(name: string, description: string, required = false): this {
    this.addBooleanOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }

  // Attachment options
  AddAttachmentOption(name: string, description: string, required = false): this {
    this.addAttachmentOption(option =>
      option.setName(name).setDescription(description).setRequired(required)
    )
    return this
  }
}

// Helper function for quick command creation
export function CreateCommand(name: string, description: string) {
  return new CommandBuilder(name, description)
}

// Common choice presets
export const CommonChoices = {
  yesNo: [
    { name: 'Yes', value: 'yes' },
    { name: 'No', value: 'no' }
  ],
  onOff: [
    { name: 'On', value: 'on' },
    { name: 'Off', value: 'off' }
  ],
  visibility: [
    { name: 'Public', value: 'public' },
    { name: 'Private', value: 'private' },
    { name: 'Hidden', value: 'hidden' }
  ]
}
