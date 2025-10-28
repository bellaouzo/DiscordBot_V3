import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../../src/Commands/Middleware/index";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * 🚀 STARTER TEMPLATE COMMAND
 * 
 * This is a complete, working command that you can copy to your bot and run immediately.
 * It demonstrates all the essential patterns you'll need for most commands.
 * 
 * HOW TO USE:
 * 1. Copy this entire file to: src/Commands/utility/starter-template.ts
 * 2. Update the command name and description below
 * 3. Modify the execute function with your logic
 * 4. Run: npm run dev
 * 5. Use the command in Discord!
 */

async function ExecuteStarterTemplate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  // Get the responders and logger from context
  const { interactionResponder } = context.responders;
  const { logger } = context;

  // Log that the command was executed
  logger.Info("Starter template command executed", {
    extra: {
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guild?.id,
    },
  });

  // Example: Get command options (uncomment if you add options)
  // const exampleOption = interaction.options.getString("example") ?? "default value";

  // Example: Simple reply
  await interactionResponder.Reply(interaction, {
    content: `👋 Hello ${interaction.user.username}! This is your starter template command.`,
  });

  // Example: Action with loading state (uncomment to try)
  /*
  await interactionResponder.WithAction({
    interaction,
    message: "⏳ Processing your request...",
    followUp: "✅ Done! Your request has been processed.",
    action: async () => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 2000));
    },
  });
  */

  // Example: Send DM to user (uncomment to try)
  /*
  const dmSent = await interactionResponder.SendDm(
    interaction.user,
    "This is a DM from your starter template command!"
  );
  
  if (dmSent) {
    await interactionResponder.FollowUp(interaction, {
      content: "📨 I've sent you a DM!",
      ephemeral: true,
    });
  }
  */
}

export const StarterTemplateCommand = CreateCommand({
  name: "starter-template", // ← Change this to your command name
  description: "A working starter template command", // ← Change this description
  group: "utility", // ← Change this group if needed (utility, moderation, etc.)
  
  // Add command options here (uncomment and modify as needed)
  /*
  configure: (builder) => {
    builder
      .addStringOption((option) =>
        option
          .setName("example")
          .setDescription("An example string option")
          .setRequired(false)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("An example user option")
          .setRequired(false)
      );
  },
  */
  
  // Middleware configuration
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware], // Always recommended
    after: [ErrorMiddleware], // Always recommended
  },
  
  // Command configuration
  config: Config.utility(2), // 2 second cooldown for utility commands
  
  // The main function that runs when the command is used
  execute: ExecuteStarterTemplate,
});

/**
 * 📚 WHAT THIS TEMPLATE SHOWS:
 * 
 * ✅ Basic command structure
 * ✅ Proper imports and types
 * ✅ Middleware usage (logging, cooldown, error handling)
 * ✅ Responder usage (Reply, WithAction, SendDm)
 * ✅ Logging with context
 * ✅ Command options (commented examples)
 * ✅ Error handling
 * 
 * 🎯 NEXT STEPS:
 * 1. Try uncommenting the example code sections
 * 2. Add your own command options
 * 3. Implement your command logic
 * 4. Test with: npm run dev
 * 5. Check out other examples in the examples/ folder for more patterns
 */
