import { CommandMiddleware } from "./index";
import { CreateErrorMessage } from "@responders/MessageFactory";

export const ErrorMiddleware: CommandMiddleware = {
  name: "error-handler",
  execute: async (context, next) => {
    try {
      await next();
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : error;

      context.logger.Error("Command execution failed", {
        command: context.command.data.name,
        interactionId: context.interaction.id,
        guildId: context.interaction.guildId ?? undefined,
        userId: context.interaction.user.id,
        error: errorDetails,
      });

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while executing this command.";

      const message = CreateErrorMessage({
        title: "Command Failed",
        description: errorMessage,
        hint: "The incident has been logged.",
      });

      if (context.interaction.replied || context.interaction.deferred) {
        await context.responders.interactionResponder.Edit(
          context.interaction,
          message
        );
      } else {
        await context.responders.interactionResponder.Reply(
          context.interaction,
          {
            ...message,
            ephemeral: true,
          }
        );
      }
    }
  },
};

