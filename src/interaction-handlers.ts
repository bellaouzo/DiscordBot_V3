import { ButtonInteraction, ChatInputCommandInteraction, Client, Events, StringSelectMenuInteraction } from 'discord.js'
import { Logger } from './Shared/Logger'
import { ComponentRouter } from './Shared/ComponentRouter'
import { SelectMenuRouter } from './Shared/SelectMenuRouter'

export interface InteractionHandlerDependencies {
  readonly client: Client
  readonly logger: Logger
  readonly componentRouter: ComponentRouter
  readonly selectMenuRouter: SelectMenuRouter
}

export function RegisterInteractionHandlers(dependencies: InteractionHandlerDependencies): void {
  dependencies.client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
      await HandleButtonInteraction(interaction, dependencies.componentRouter, dependencies.logger)
    } else if (interaction.isStringSelectMenu()) {
      await HandleSelectMenuInteraction(interaction, dependencies.selectMenuRouter, dependencies.logger)
    }
  })
}

async function HandleButtonInteraction(
  interaction: ButtonInteraction,
  router: ComponentRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleButton(interaction)
  if (!handled) {
    logger.Debug('Unhandled button interaction', {
      extra: {
        customId: interaction.customId
      }
    })
  }
}

async function HandleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  router: SelectMenuRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleSelectMenu(interaction)
  if (!handled) {
    logger.Debug('Unhandled select menu interaction', {
      extra: {
        customId: interaction.customId
      }
    })
  }
}

export function HandleCommandInteraction(interaction: ChatInputCommandInteraction): boolean {
  return interaction.isChatInputCommand()
}