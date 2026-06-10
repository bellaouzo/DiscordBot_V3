import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * Simple ping command that shows bot latency.
 * Demonstrates `WithAction` and config-driven middleware.
 */
async function ExecutePing(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  await interactionResponder.WithAction({
    interaction,
    message: "Pinging...",
    followUp: `Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`,
    action: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  });
}

export const PingCommand = CreateCommand({
  name: "ping",
  description: "Replies with Pong!",
  group: "utility",
  config: Config.utility(1),
  execute: ExecutePing,
});
