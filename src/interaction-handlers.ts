import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  ContextMenuCommandInteraction,
  Interaction,
} from "discord.js";
import { DiscordAPIError, Events, MessageFlags } from "discord.js";
import type { Logger } from "@shared/Logger";
import type { ComponentRouter } from "@shared/ComponentRouter";
import type { SelectMenuRouter } from "@shared/SelectMenuRouter";
import type { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import type { ModalRouter } from "@shared/ModalRouter";
import type { RoutableInteraction } from "@shared/InteractionRouter";
import type { CommandDefinition, ContextMenuDefinition } from "@commands";
import { ResolveCommand, ResolveContextMenu } from "@commands";
import type { ResponderSet } from "@responders";
import type { BlocklistMatch } from "@middleware/BlocklistMiddleware";
import { CreateBlocklistReply } from "@middleware/BlocklistMiddleware";

export interface InteractionHandlerDependencies {
  readonly client: Client;
  readonly logger: Logger;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
  readonly modalRouter: ModalRouter;
  /** Global blocklist lookup; blocked users and guilds can't use buttons, menus or modals. */
  readonly findBlocklistMatch?: (
    userId: string,
    guildId: string | null,
  ) => BlocklistMatch | null;
}

/** Component handlers slower than this get a warning (Discord's response deadline is 3s). */
const SLOW_COMPONENT_THRESHOLD_MS = 2500;

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

  const blocked = dependencies.findBlocklistMatch?.(
    route.interaction.user.id,
    route.interaction.guildId,
  );
  if (blocked) {
    dependencies.logger.Debug(`Blocked ${route.kind} interaction`, {
      userId: route.interaction.user.id,
      guildId: route.interaction.guildId ?? undefined,
      extra: { customId: route.interaction.customId },
    });
    await route.interaction
      .reply(CreateBlocklistReply(blocked))
      .catch(() => undefined);
    return;
  }

  const startedAt = Date.now();
  try {
    const handled = await route.handle();
    if (!handled) {
      await ReplyToUnhandledInteraction(
        route.interaction,
        dependencies.logger,
        `Unhandled ${route.kind} interaction`,
      );
    }
  } catch (error) {
    // Routers catch handler errors themselves; this guards the dispatch around them.
    dependencies.logger.Error(`Failed to dispatch ${route.kind} interaction`, {
      userId: route.interaction.user.id,
      guildId: route.interaction.guildId ?? undefined,
      extra: { customId: route.interaction.customId },
      error,
    });
  }

  const durationMs = Date.now() - startedAt;
  if (durationMs > SLOW_COMPONENT_THRESHOLD_MS) {
    dependencies.logger.Warn(`Slow ${route.kind} interaction`, {
      extra: { customId: route.interaction.customId, durationMs },
    });
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

export type AutocompleteExecutorFn = (
  command: CommandDefinition,
  interaction: AutocompleteInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

export type ContextMenuExecutorFn = (
  menu: ContextMenuDefinition,
  interaction: ContextMenuCommandInteraction,
  responders: ResponderSet,
  commandLogger: Logger,
) => Promise<void>;

export interface CommandHandlerDependencies {
  readonly client: Client;
  readonly executeCommand: CommandExecutorFn;
  readonly executeAutocomplete?: AutocompleteExecutorFn;
  readonly executeContextMenu?: ContextMenuExecutorFn;
  readonly responders: ResponderSet;
  readonly logger: Logger;
}

export function RegisterCommandHandler(
  dependencies: CommandHandlerDependencies,
): void {
  dependencies.client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      await DispatchAutocomplete(interaction, dependencies);
      return;
    }

    if (interaction.isContextMenuCommand()) {
      await DispatchContextMenu(interaction, dependencies);
      return;
    }

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

    try {
      await dependencies.executeCommand(
        command,
        interaction,
        dependencies.responders,
        commandLogger,
      );
    } catch (error) {
      // ErrorMiddleware handles command failures; this only catches failures in the executor.
      commandLogger.Error("Unhandled error while executing command", {
        error,
      });
    }
  });
}

async function DispatchContextMenu(
  interaction: ContextMenuCommandInteraction,
  dependencies: CommandHandlerDependencies,
): Promise<void> {
  const menu = ResolveContextMenu(
    interaction.isUserContextMenuCommand() ? "user" : "message",
    interaction.commandName,
  );
  if (!menu || !dependencies.executeContextMenu) {
    return;
  }

  const commandLogger = dependencies.logger.Child({
    command: menu.linked.command,
    interactionId: interaction.id,
    guildId: interaction.guildId ?? undefined,
    userId: interaction.user.id,
  });

  try {
    await dependencies.executeContextMenu(
      menu,
      interaction,
      dependencies.responders,
      commandLogger,
    );
  } catch (error) {
    commandLogger.Error("Unhandled error while executing context menu", {
      error,
    });
  }
}

async function DispatchAutocomplete(
  interaction: AutocompleteInteraction,
  dependencies: CommandHandlerDependencies,
): Promise<void> {
  const command = ResolveCommand(interaction.commandName);
  if (!command?.autocomplete || !dependencies.executeAutocomplete) {
    return;
  }

  const commandLogger = dependencies.logger.Child({
    command: command.data.name,
    interactionId: interaction.id,
    guildId: interaction.guildId ?? undefined,
    userId: interaction.user.id,
  });

  await dependencies.executeAutocomplete(
    command,
    interaction,
    dependencies.responders,
    commandLogger,
  );
}
