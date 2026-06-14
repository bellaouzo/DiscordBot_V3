import type { Message } from "discord.js";
import type { EventContext } from "@events/EventFactory";
import type { MessageCreateHandler } from "./types";

export async function RunMessageCreateHandlers(
  context: EventContext,
  msg: Message,
  handlers: readonly MessageCreateHandler[],
): Promise<void> {
  for (const handler of handlers) {
    try {
      const result = await handler.execute(context, msg);
      if (result === "stop") {
        return;
      }
    } catch (error) {
      context.logger.Error("MessageCreate handler failed", {
        error,
        extra: { handler: handler.name },
      });
    }
  }
}
