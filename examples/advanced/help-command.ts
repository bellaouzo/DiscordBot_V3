import type { ChatInputCommandInteraction} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext} from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import type { PaginationPage } from "@shared/Paginator";
import { AllCommands } from "@commands";
import { EmbedFactory } from "@utilities";

/**
 * Interactive help command with pagination and buttons
 * Demonstrates:
 * - Pagination system
 * - Component routing
 * - Caching
 * - Rich embeds
 * - Button interactions
 */

// Cache for commands (5 minutes)
const commandCache = new Map<
  string,
  { data: CommandInfo[]; timestamp: number }
>();
const CACHE_DURATION = 1000 * 60 * 5;

interface CommandInfo {
  readonly name: string;
  readonly description: string;
  readonly group: string;
}

interface HelpSection {
  readonly name: string;
  readonly description: string;
  readonly commands: CommandInfo[];
  readonly icon: string;
  readonly color: number;
}

async function ExecuteHelp(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { paginatedResponder } = context.responders;
  const { logger } = context;

  try {
    // Get commands (cached for performance)
    const allCommands = await GetAllCommandsCached();
    const sections = GroupCommandsBySection(allCommands);

    // Create paginated pages
    const pages = CreateOptimizedPages(sections);

    // Send paginated help menu
    await paginatedResponder.Send({
      interaction,
      pages,
      flags: MessageFlags.Ephemeral,
      ownerId: interaction.user.id,
      timeoutMs: 1000 * 60 * 5, // 5 minutes
    });

    logger.Info("Help command executed", {
      extra: {
        userId: interaction.user.id,
        commandCount: allCommands.length,
        sectionCount: sections.length,
      },
    });
  } catch (error) {
    logger.Error("Help command failed", { error });
    throw error;
  }
}

// Helper functions (simplified for example)
async function GetAllCommandsCached(): Promise<CommandInfo[]> {
  const cacheKey = "all-commands";
  const cached = commandCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const commands = AllCommands().map((cmd) => ({
    name: cmd.data.name,
    description: cmd.data.description,
    group: cmd.group,
  }));

  commandCache.set(cacheKey, { data: commands, timestamp: Date.now() });
  return commands;
}

function GroupCommandsBySection(commands: CommandInfo[]): HelpSection[] {
  const groups = new Map<string, CommandInfo[]>();

  for (const command of commands) {
    const group = command.group;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)?.push(command);
  }

  return Array.from(groups.entries()).map(([name, commands]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    description: `Commands for ${name}`,
    commands,
    icon: "🔧",
    color: 0x5865f2,
  }));
}

function CreateOptimizedPages(sections: HelpSection[]): PaginationPage[] {
  const overviewPage: PaginationPage = {
    content: "📚 **Help Menu** - Use buttons to navigate",
    embeds: [EmbedFactory.CreateHelpOverview(5, 2).toJSON()],
  };

  const sectionPages: PaginationPage[] = sections.map((section) => ({
    embeds: [
      EmbedFactory.CreateHelpSection(
        section.name,
        section.description,
        section.commands.length
      ).toJSON(),
    ],
  }));

  return [overviewPage, ...sectionPages];
}

export const HelpCommand = CreateCommand({
  name: "help",
  description: "📚 Browse all available bot commands with an interactive menu",
  group: "utility",
  config: Config.utility(0),
  execute: ExecuteHelp,
});
