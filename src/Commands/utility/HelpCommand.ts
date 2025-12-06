import {
  ActionRowComponentData,
  ActionRowData,
  APIEmbed,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
} from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
import { ErrorMiddleware } from "../Middleware/ErrorMiddleware";
import { Config } from "../Middleware/CommandConfig";
import { AllCommands } from "../registry";
import { EmbedFactory, ComponentFactory } from "../../Utilities";
import { ButtonResponder } from "../../Responders";

interface CommandInfo {
  readonly name: string;
  readonly description: string;
  readonly group: string;
}

interface CategoryView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly commands: CommandInfo[];
  readonly pages: APIEmbed[];
}

interface OverviewPayload {
  readonly content: string;
  readonly embeds: APIEmbed[];
  readonly components: ActionRowData<ActionRowComponentData>[];
}

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
const commandCache = new Map<
  string,
  { data: CommandInfo[]; timestamp: number }
>();

async function ExecuteHelp(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const { logger } = context;

  try {
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
      ephemeral: true,
    });

    if (!response.success) {
      logger.Warn("Help command failed to send reply", {
        userId: interaction.user.id,
      });
    }
  } catch (error) {
    logger.Error("Help command failed", { error });
    throw error;
  }
}

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

function BuildCategoryViews(commands: CommandInfo[]): CategoryView[] {
  const groups = new Map<string, CommandInfo[]>();

  commands.forEach((command) => {
    const group = command.group;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(command);
  });

  const categories: CategoryView[] = [];

  groups.forEach((groupCommands, key) => {
    const sortedCommands = [...groupCommands].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    categories.push({
      key,
      name: FormatGroupName(key),
      description: GetGroupDescription(key),
      icon: GetGroupIcon(key),
      commands: sortedCommands,
      pages: CreateCategoryPages({
        key,
        name: FormatGroupName(key),
        description: GetGroupDescription(key),
        icon: GetGroupIcon(key),
        commands: sortedCommands,
      }),
    });
  });

  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

function CreateOverviewPayload(
  categories: CategoryView[],
  interactionId: string
): OverviewPayload {
  const totalCommands = categories.reduce(
    (sum, category) => sum + category.commands.length,
    0
  );

  const embed = EmbedFactory.CreateHelpOverview(
    totalCommands,
    categories.length
  );

  categories.forEach((category) => {
    embed.addFields({
      name: `${category.icon} ${category.name}`,
      value: `**${category.commands.length} commands**`,
      inline: true,
    });
  });

  return {
    content: `📚 **Help Menu** — ${totalCommands} commands available. Choose a category below.`,
    embeds: [embed.toJSON()],
    components: BuildCategoryRows(categories, interactionId),
  };
}

function RegisterHelpButtons(options: {
  readonly categories: CategoryView[];
  readonly componentRouter: CommandContext["responders"]["componentRouter"];
  readonly buttonResponder: ButtonResponder;
  readonly interaction: ChatInputCommandInteraction;
  readonly ownerId: string;
}): void {
  const { categories, componentRouter, buttonResponder, interaction, ownerId } =
    options;
  const interactionId = interaction.id;

  componentRouter.RegisterButton({
    customId: CreateOverviewCustomId(interactionId),
    ownerId,
    handler: async (buttonInteraction: ButtonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);
      const overview = CreateOverviewPayload(categories, interactionId);
      await buttonResponder.EditReply(buttonInteraction, {
        content: overview.content,
        embeds: overview.embeds,
        components: overview.components,
      });
    },
    expiresInMs: 1000 * 60 * 5,
  });

  categories.forEach((category) => {
    componentRouter.RegisterButton({
      customId: CreateCategorySelectCustomId(interactionId, category.key),
      ownerId,
      handler: async (buttonInteraction: ButtonInteraction) => {
        await ShowCategoryPage({
          buttonInteraction,
          buttonResponder,
          categories,
          category,
          interactionId,
          pageIndex: 0,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        category.key,
        "first",
        0
      ),
      ownerId,
      handler: async (buttonInteraction) => {
        await ShowCategoryPage({
          buttonInteraction,
          buttonResponder,
          categories,
          category,
          interactionId,
          pageIndex: 0,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        category.key,
        "prev",
        1
      ),
      ownerId,
      handler: async (buttonInteraction) => {
        const parsed = ParseCategoryPageNavCustomId(buttonInteraction.customId);
        if (!parsed) {
          return;
        }

        await ShowCategoryPage({
          buttonInteraction,
          buttonResponder,
          categories,
          category,
          interactionId,
          pageIndex: Math.max(parsed.pageIndex - 1, 0),
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        category.key,
        "next",
        0
      ),
      ownerId,
      handler: async (buttonInteraction) => {
        const parsed = ParseCategoryPageNavCustomId(buttonInteraction.customId);
        if (!parsed) {
          return;
        }

        const totalPages = category.pages.length;
        await ShowCategoryPage({
          buttonInteraction,
          buttonResponder,
          categories,
          category,
          interactionId,
          pageIndex: Math.min(parsed.pageIndex + 1, totalPages - 1),
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });

    componentRouter.RegisterButton({
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        category.key,
        "last",
        category.pages.length - 1
      ),
      ownerId,
      handler: async (buttonInteraction) => {
        const totalPages = category.pages.length;
        await ShowCategoryPage({
          buttonInteraction,
          buttonResponder,
          categories,
          category,
          interactionId,
          pageIndex: totalPages - 1,
        });
      },
      expiresInMs: 1000 * 60 * 5,
    });
  });
}

async function ShowCategoryPage(options: {
  readonly buttonInteraction: ButtonInteraction;
  readonly buttonResponder: ButtonResponder;
  readonly categories: CategoryView[];
  readonly category: CategoryView;
  readonly interactionId: string;
  readonly pageIndex: number;
}): Promise<void> {
  const {
    buttonInteraction,
    buttonResponder,
    categories,
    category,
    interactionId,
    pageIndex,
  } = options;

  const totalPages = category.pages.length;
  const clampedIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));

  await buttonResponder.DeferUpdate(buttonInteraction);

  await buttonResponder.EditReply(buttonInteraction, {
    content: `**${category.name} Commands** — Page ${
      clampedIndex + 1
    }/${totalPages}`,
    embeds: [category.pages[clampedIndex]],
    components: [
      ...BuildCategoryRows(categories, interactionId, category.key),
      BuildPaginationRow(interactionId, category.key, clampedIndex, totalPages),
    ],
  });
}

function BuildCategoryRows(
  categories: CategoryView[],
  interactionId: string,
  activeKey?: string
): ActionRowData<ActionRowComponentData>[] {
  if (categories.length === 0) {
    return [];
  }

  const buttons = categories.map((category) => ({
    label: category.name,
    style:
      category.key === activeKey ? ButtonStyle.Primary : ButtonStyle.Secondary,
    emoji: category.icon || undefined,
    customId: CreateCategorySelectCustomId(interactionId, category.key),
  }));

  return ChunkArray(buttons, 5).map(
    (rowButtons) =>
      ComponentFactory.CreateActionRow({
        buttons: rowButtons.map((button) => ({
          label: button.label,
          style: button.style,
          emoji: button.emoji,
        })),
        customIds: rowButtons.map((button) => button.customId),
      }).toJSON() as ActionRowData<ActionRowComponentData>
  );
}

function BuildPaginationRow(
  interactionId: string,
  categoryKey: string,
  pageIndex: number,
  totalPages: number
): ActionRowData<ActionRowComponentData> {
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === totalPages - 1;

  const buttons = [
    {
      label: "⏮",
      style: ButtonStyle.Secondary,
      disabled: isFirst,
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        categoryKey,
        "first"
      ),
    },
    {
      label: "◀",
      style: ButtonStyle.Secondary,
      disabled: isFirst,
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        categoryKey,
        "prev",
        pageIndex
      ),
    },
    {
      label: "🏠 Overview",
      style: ButtonStyle.Primary,
      disabled: false,
      customId: CreateOverviewCustomId(interactionId),
    },
    {
      label: "▶",
      style: ButtonStyle.Secondary,
      disabled: isLast,
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        categoryKey,
        "next",
        pageIndex
      ),
    },
    {
      label: "⏭",
      style: ButtonStyle.Secondary,
      disabled: isLast,
      customId: CreateCategoryPageNavCustomId(
        interactionId,
        categoryKey,
        "last",
        totalPages - 1
      ),
    },
  ];

  return ComponentFactory.CreateActionRow({
    buttons: buttons.map((button) => ({
      label: button.label,
      style: button.style,
      disabled: button.disabled,
    })),
    customIds: buttons.map((button) => button.customId),
  }).toJSON() as ActionRowData<ActionRowComponentData>;
}

function CreateCategoryPages(
  category: Pick<
    CategoryView,
    "key" | "name" | "description" | "icon" | "commands"
  >
): APIEmbed[] {
  if (category.commands.length === 0) {
    const emptyEmbed = EmbedFactory.CreateHelpSection(
      category.name,
      category.description,
      0
    );
    emptyEmbed.addFields({
      name: "🚫 No Commands",
      value: "This category currently has no available commands.",
      inline: false,
    });
    return [emptyEmbed.toJSON()];
  }

  const commandChunks = ChunkArray(category.commands, 8);

  return commandChunks.map((chunk, index) => {
    const embed = EmbedFactory.CreateHelpSection(
      category.name,
      category.description,
      category.commands.length
    );

    const commandList = chunk
      .map((command) => `\`/${command.name}\` — ${command.description}`)
      .join("\n");

    embed.addFields({
      name: index === 0 ? "📋 Available Commands" : "📋 Commands (continued)",
      value: commandList,
      inline: false,
    });

    return embed.toJSON();
  });
}

function CreateOverviewCustomId(interactionId: string): string {
  return `help:${interactionId}:overview`;
}

function CreateCategorySelectCustomId(
  interactionId: string,
  key: string
): string {
  return `help:${interactionId}:select:${key}`;
}

function CreateCategoryPageNavCustomId(
  interactionId: string,
  key: string,
  action: "first" | "prev" | "next" | "last",
  currentPage = 0
): string {
  const targetPage =
    action === "first"
      ? 0
      : action === "last"
        ? currentPage
        : action === "prev"
          ? Math.max(currentPage - 1, 0)
          : Math.max(currentPage + 1, 0);

  return `help:${interactionId}:page:${key}:${action}:${targetPage}`;
}

function ParseCategoryPageNavCustomId(customId: string): {
  interactionId: string;
  key: string;
  action: "first" | "prev" | "next" | "last";
  pageIndex: number;
} | null {
  const match = customId.match(
    /^help:(\d+):page:([\w-]+):(first|prev|next|last):(\d+)$/
  );
  if (!match) {
    return null;
  }

  return {
    interactionId: match[1],
    key: match[2],
    action: match[3] as "first" | "prev" | "next" | "last",
    pageIndex: Number.parseInt(match[4], 10),
  };
}

function FormatGroupName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

function GetGroupDescription(group: string): string {
  const descriptions: Record<string, string> = {
    utility: "🔧 General utility commands for everyday use",
    moderation: "🛡️ Commands for moderating the server",
    admin: "⚙️ Administrative commands for server management",
    fun: "🎮 Fun and entertainment commands",
    info: "📊 Information and lookup commands",
    music: "🎵 Music and audio commands",
    economy: "💰 Economy and currency commands",
    games: "🎲 Gaming and interactive commands",
  };
  return descriptions[group] ?? "📦 Commands for this category";
}

function GetGroupIcon(group: string): string {
  const icons: Record<string, string> = {
    utility: "🔧",
    moderation: "🛡️",
    admin: "⚙️",
    fun: "🎮",
    info: "📊",
    music: "🎵",
    economy: "💰",
    games: "🎲",
  };
  return icons[group] ?? "📦";
}

function ChunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export const HelpCommand = CreateCommand({
  name: "help",
  description: "📚 Browse all available bot commands with an interactive menu",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(0),
  execute: ExecuteHelp,
});
