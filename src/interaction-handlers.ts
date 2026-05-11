import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  Interaction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { Logger } from "./Shared/Logger";
import { ComponentRouter } from "./Shared/ComponentRouter";
import { SelectMenuRouter } from "./Shared/SelectMenuRouter";
import { UserSelectMenuRouter } from "./Shared/UserSelectMenuRouter";
import { ModalRouter } from "./Shared/ModalRouter";
import { CommandDefinition, ResolveCommand } from "./Commands";
import { ResponderSet } from "./Responders";

export interface InteractionHandlerDependencies {
  readonly client: Client;
  readonly logger: Logger;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
  readonly modalRouter: ModalRouter;
}

export function RegisterInteractionHandlers(
  dependencies: InteractionHandlerDependencies
): void {
  dependencies.client.on(Events.InteractionCreate, async (interaction) => {
    await DispatchComponentInteraction(interaction, dependencies);
  });
}

async function DispatchComponentInteraction(
  interaction: Interaction,
  dependencies: InteractionHandlerDependencies
): Promise<void> {
  if (interaction.isButton()) {
    await HandleButtonInteraction(
      interaction,
      dependencies.componentRouter,
      dependencies.logger
    );
    return;
  }

  if (interaction.isStringSelectMenu()) {
    await HandleSelectMenuInteraction(
      interaction,
      dependencies.selectMenuRouter,
      dependencies.logger
    );
    return;
  }

  if (interaction.isUserSelectMenu()) {
    await HandleUserSelectMenuInteraction(
      interaction,
      dependencies.userSelectMenuRouter,
      dependencies.logger
    );
    return;
  }

  if (interaction.isModalSubmit()) {
    await HandleModalInteraction(
      interaction,
      dependencies.modalRouter,
      dependencies.logger
    );
  }
}

async function HandleButtonInteraction(
  interaction: ButtonInteraction,
  router: ComponentRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleButton(interaction);
  if (!handled) {
    await ReplyToUnhandledInteraction(
      interaction,
      logger,
      "Unhandled button interaction"
    );
  }
}

async function HandleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  router: SelectMenuRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleSelectMenu(interaction);
  if (!handled) {
    await ReplyToUnhandledInteraction(
      interaction,
      logger,
      "Unhandled select menu interaction"
    );
  }
}

async function HandleUserSelectMenuInteraction(
  interaction: UserSelectMenuInteraction,
  router: UserSelectMenuRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleUserSelectMenu(interaction);
  if (!handled) {
    await ReplyToUnhandledInteraction(
      interaction,
      logger,
      "Unhandled user select menu interaction"
    );
  }
}

async function HandleModalInteraction(
  interaction: ModalSubmitInteraction,
  router: ModalRouter,
  logger: Logger
): Promise<void> {
  const handled = await router.HandleModal(interaction);
  if (!handled) {
    await ReplyToUnhandledInteraction(
      interaction,
      logger,
      "Unhandled modal interaction"
    );
  }
}

async function ReplyToUnhandledInteraction(
  interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | UserSelectMenuInteraction
    | ModalSubmitInteraction,
  logger: Logger,
  logMessage: string
): Promise<void> {
  logger.Debug(logMessage, {
    extra: {
      customId: interaction.customId,
    },
  });

  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction
    .reply({
      content: "This interaction is no longer available.",
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

export type CommandExecutorFn = (
  command: CommandDefinition,
  interaction: ChatInputCommandInteraction,
  responders: ResponderSet,
  commandLogger: Logger
) => Promise<void>;

export interface CommandHandlerDependencies {
  readonly client: Client;
  readonly executeCommand: CommandExecutorFn;
  readonly responders: ResponderSet;
  readonly logger: Logger;
}

export function RegisterCommandHandler(
  dependencies: CommandHandlerDependencies
): void {
  dependencies.client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = ResolveCommand(interaction.commandName);
    if (!command) {
      return;
    }

    const commandLogger = dependencies.logger.Child({
      command: command.data.name,
      interactionId: interaction.id,
      guildId: interaction.guildId ?? undefined,
      userId: interaction.user.id,
    });

    await dependencies.executeCommand(
      command,
      interaction,
      dependencies.responders,
      commandLogger
    );
  });
}
