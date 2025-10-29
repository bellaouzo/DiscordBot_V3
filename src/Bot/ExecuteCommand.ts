import { ChatInputCommandInteraction } from "discord.js";
import { CommandDefinition, CommandContext } from "../Commands";
import { Logger } from "../Shared/Logger";
import { ResponderSet } from "../Responders";
import {
  MiddlewareContext,
  RunMiddlewareChain,
  DiscordLoggingMiddleware,
} from "../Commands/Middleware";

export function CreateCommandExecutor() {
  return async (
    command: CommandDefinition,
    interaction: ChatInputCommandInteraction,
    responders: ResponderSet,
    commandLogger: Logger
  ): Promise<void> => {
    const middleware = command.middleware?.before ?? [];
    const afterMiddleware = [
      ...(command.middleware?.after ?? []),
      DiscordLoggingMiddleware,
    ];

    const context: MiddlewareContext = {
      interaction,
      command,
      logger: commandLogger,
      responders,
      config: command.config ?? {},
    };

    const finalHandler = async (): Promise<void> => {
      const commandContext: CommandContext = {
        responders,
        logger: commandLogger,
      };
      await command.execute(interaction, commandContext);
    };

    const middlewareChain = [...middleware, ...afterMiddleware];

    await RunMiddlewareChain(middlewareChain, context, finalHandler);
  };
}
