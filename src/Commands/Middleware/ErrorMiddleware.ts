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

      const message = CreateErrorMessage({
        title: "Command Failed",
        description:
          "Something went wrong while executing this command. Please try again in a moment.",
        hint: "The incident has been logged.",
      });

      try {
        if (context.interaction.replied || context.interaction.deferred) {
          await context.responders.interactionResponder.Edit(
            context.interaction,
            message
          );
          return;
        }

        await context.responders.interactionResponder.Reply(
          context.interaction,
          {
            ...message,
            ephemeral: true,
          }
        );
      } catch (responderError) {
        context.logger.Error("Failed to send command error response", {
          command: context.command.data.name,
          interactionId: context.interaction.id,
          userId: context.interaction.user.id,
          error: responderError,
        });
      }
    }
  },
};

