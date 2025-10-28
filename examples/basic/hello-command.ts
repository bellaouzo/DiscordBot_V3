import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import { LoggingMiddleware, ErrorMiddleware } from "../../src/Commands/Middleware/index";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * Basic hello command
 * Demonstrates simple reply responder usage
 */
async function ExecuteHello(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  const user = interaction.user;
  
  logger.Info("Hello command executed", { 
    extra: { userId: user.id, username: user.username } 
  });
  
  await interactionResponder.Reply(interaction, { 
    content: `Hello ${user.username}! 👋` 
  });
}

export const HelloCommand = CreateCommand({
  name: "hello",
  description: "Say hello to the bot",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(0), // No cooldown
  execute: ExecuteHello,
});
