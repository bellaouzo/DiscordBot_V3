import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  BuildCategoryViews,
  GetAllCommandsCached,
} from "@commands/Utility/Help/HelpCatalog";
import { CreateOverviewPayload } from "@commands/Utility/Help/HelpComponents";
import { RegisterHelpButtons } from "@commands/Utility/Help/HelpRouting";

async function ExecuteHelp(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const { logger } = context;

  const allCommands = await GetAllCommandsCached();
  const categories = BuildCategoryViews(allCommands);

  const overview = CreateOverviewPayload(categories, interaction.id);

  RegisterHelpButtons({
    categories,
    componentRouter,
    buttonResponder,
    interaction,
    ownerId: interaction.user.id,
  });

  const response = await interactionResponder.Reply(interaction, {
    content: overview.content,
    embeds: overview.embeds,
    components: overview.components,
    flags: MessageFlags.Ephemeral,
  });

  if (!response.success) {
    logger.Warn("Help command failed to send reply", {
      userId: interaction.user.id,
    });
  }
}

export const HelpCommand = CreateCommand({
  name: "help",
  description: "📚 Browse all available bot commands with an interactive menu",
  group: "utility",
  config: Config.utility(0),
  execute: ExecuteHelp,
});
