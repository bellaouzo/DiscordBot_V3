import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../../src/Commands";
import { Config } from "../../src/Commands/Middleware/CommandConfig";

/**
 * STARTER TEMPLATE COMMAND
 *
 * Copy to `src/Commands/Utility/StarterTemplateCommand.ts` (or your group folder),
 * then rename and adjust the execute logic.
 *
 * Middleware (logging, guild-only, cooldown, error handling) is applied
 * automatically from `config` — you do not wire `before` / `after` arrays.
 */

async function ExecuteStarterTemplate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  logger.Info("Starter template command executed", {
    extra: {
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guild?.id,
    },
  });

  await interactionResponder.Reply(interaction, {
    content: `Hello ${interaction.user.username}! This is your starter template command.`,
  });
}

export const StarterTemplateCommand = CreateCommand({
  name: "starter-template",
  description: "A working starter template command",
  group: "utility",
  config: Config.utility(2),
  execute: ExecuteStarterTemplate,
});
