import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands/CommandFactory";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../../src/Commands/Middleware/index";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * Simple ping command that shows bot latency
 * Demonstrates basic command structure and action responder
 */
async function ExecutePing(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { actionResponder } = context.responders;

  await actionResponder.Send({
    interaction,
    message: "Pinging...",
    followUp: `Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`,
    action: async () => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  });
}

export const PingCommand = CreateCommand({
  name: "ping",
  description: "Replies with Pong!",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(1), // 1 second cooldown
  execute: ExecutePing,
});
