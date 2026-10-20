import type {
  ChatInputCommandInteraction,
  Client,
  Interaction,
} from "discord.js";
import { DiscordAPIError, Events, MessageFlags } from "discord.js";
import type { Logger } from "@shared/Logger";
import type { ComponentRouter } from "@shared/ComponentRouter";
import type { SelectMenuRouter } from "@shared/SelectMenuRouter";
import type { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import type { ModalRouter } from "@shared/ModalRouter";
import type { RoutableInteraction } from "@shared/InteractionRouter";
import type { CommandDefinition } from "@commands";
import { ResolveCommand } from "@commands";
import type { ResponderSet } from "@responders";

export interface InteractionHandlerDependencies {
  readonly client: Client;
  readonly logger: Logger;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
  readonly modalRouter: ModalRouter;
}

export function RegisterInteractionHandlers(
  dependencies: InteractionHandlerDependencies,
): void {
  dependencies.client.on(Events.InteractionCreate, async (interaction) => {
    await DispatchComponentInteraction(interaction, dependencies);
  });
}

interface InteractionRoute {
  readonly interaction: RoutableInteraction;
  readonly kind: string;
  readonly handle: () => Promise<boolean>;
}

function ResolveInteractionRoute(
  interaction: Interaction,
  dependencies: InteractionHandlerDependencies,
): InteractionRoute | null {
  if (interaction.isButton()) {
    return {
      interaction,
      kind: "button",
      handle: () => dependencies.componentRouter.HandleButton(interaction),
    };
  }

  if (interaction.isStringSelectMenu()) {
    return {
      interaction,
      kind: "select menu",
      handle: () => dependencies.selectMenuRouter.HandleSelectMenu(interaction),
    };
  }

  if (interaction.isUserSelectMenu()) {
    return {
      interaction,
      kind: "user select menu",
      handle: () =>
        dependencies.userSelectMenuRouter.HandleUserSelectMenu(interaction),
    };
  }

  if (interaction.isModalSubmit()) {
    return {
      interaction,
      kind: "modal",
      handle: () => dependencies.modalRouter.HandleModal(interaction),
    };
  }

  return null;
}

async function DispatchComponentInteraction(
  interaction: Interaction,
  dependencies: InteractionHandlerDependencies,
): Promise<void> {
  const route = ResolveInteractionRoute(interaction, dependencies);
  if (!route) {
    return;
  }

  const handled = await route.handle();
  if (!handled) {
    await ReplyToUnhandledInteraction(
      route.interaction,
      dependencies.logger,
      `Unhandled ${route.kind} interaction`,
    );
  }
}

async function ReplyToUnhandledInteraction(
  interaction: RoutableInteraction,
  logger: Logger,
  logMessage: string,
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
    .catch((error: unknown) => {
      const code =
        error instanceof DiscordAPIError ? String(error.code) : undefined;
      const isExpected =
        code === "10062" || code === "40060" || code === "10008";

      if (isExpected) {
        logger.Debug("Could not reply to unhandled interaction", {
          extra: { customId: interaction.customId, code },
          error,
        });
        return;
      }

      logger.Warn("Could not reply to unhandled interaction", {
        extra: { customId: interaction.customId, code },
        error,
      });
    });
}

export type CommandExecutorFn = (
  command: CommandDefinition,
  interaction: ChatInputCommandInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

export interface CommandHandlerDependencies {
  readonly client: Client;
  readonly executeCommand: CommandExecutorFn;
  readonly responders: ResponderSet;
  readonly logger: Logger;
}

export function RegisterCommandHandler(
  dependencies: CommandHandlerDependencies,
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
      commandLogger,
    );
  });
}
