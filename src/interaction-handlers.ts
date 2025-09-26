import { ButtonInteraction, ChatInputCommandInteraction, Client, Events } from 'discord.js'
import { Logger } from './Shared/Logger'
import { ComponentRouter } from './Shared/ComponentRouter'

export interface InteractionHandlerDependencies {
  readonly client: Client
  readonly logger: Logger
  readonly componentRouter: ComponentRouter
}

export function RegisterInteractionHandlers(dependencies: InteractionHandlerDependencies): void {
  dependencies.client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
      await HandleButtonInteraction(interaction, dependencies.componentRouter, dependencies.logger)
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

export function HandleCommandInteraction(interaction: ChatInputCommandInteraction): boolean {
  return interaction.isChatInputCommand()
}