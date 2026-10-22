import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";

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
  config: { cooldown: "1s" },
  execute: ExecutePing,
});
