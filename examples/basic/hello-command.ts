import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * Basic hello command — simple reply and logging via context.
 */
async function ExecuteHello(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;
  const user = interaction.user;

  logger.Info("Hello command executed", {
    extra: { userId: user.id, username: user.username },
  });

  await interactionResponder.Reply(interaction, {
    content: `Hello ${user.username}!`,
  });
}

export const HelloCommand = CreateCommand({
  name: "hello",
  description: "Say hello to the bot",
  group: "utility",
  config: Config.utility(0),
  execute: ExecuteHello,
});
