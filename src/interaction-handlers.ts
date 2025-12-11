import {
  ButtonInteraction,
  Client,
  Events,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { Logger } from "./Shared/Logger";
import { ComponentRouter } from "./Shared/ComponentRouter";
import { SelectMenuRouter } from "./Shared/SelectMenuRouter";
import { UserSelectMenuRouter } from "./Shared/UserSelectMenuRouter";

export interface InteractionHandlerDependencies {
  readonly client: Client;
  readonly logger: Logger;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
}

export function RegisterInteractionHandlers(
  dependencies: InteractionHandlerDependencies
): void {
  dependencies.client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      await HandleButtonInteraction(
        interaction,
        dependencies.componentRouter,
        dependencies.logger
      );
    } else if (interaction.isStringSelectMenu()) {
      await HandleSelectMenuInteraction(
        interaction,
        dependencies.selectMenuRouter,
        dependencies.logger
      );
    } else if (interaction.isUserSelectMenu()) {
      await HandleUserSelectMenuInteraction(
        interaction,
        dependencies.userSelectMenuRouter,
        dependencies.logger
      );
    }
  });
}

async function HandleButtonInteraction(
  interaction: ButtonInteraction,
  router: ComponentRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleButton(interaction);
  if (!handled) {
    logger.Debug("Unhandled button interaction", {
      extra: {
        customId: interaction.customId,
      },
    });
  }
}

async function HandleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  router: SelectMenuRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleSelectMenu(interaction);
  if (!handled) {
    logger.Debug("Unhandled select menu interaction", {
      extra: {
        customId: interaction.customId,
      },
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction
        .reply({
          content: "This interaction is no longer available.",
          flags: 64,
        })
        .catch(() => {});
    }
  }
}

async function HandleUserSelectMenuInteraction(
  interaction: UserSelectMenuInteraction,
  router: UserSelectMenuRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleUserSelectMenu(interaction);
  if (!handled) {
    logger.Debug("Unhandled user select menu interaction", {
      extra: {
        customId: interaction.customId,
      },
    });
  }
}
