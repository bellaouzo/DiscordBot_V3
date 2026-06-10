import { ActionRowComponentData, ActionRowData, ButtonStyle } from "discord.js";
import { ComponentFactory, EmbedFactory } from "@utilities";
import {
  CategoryView,
  OverviewPayload,
} from "@commands/Utility/Help/HelpTypes";
import { ChunkArray } from "@commands/Utility/Help/HelpCatalog";
import {
  CreateCategoryPageNavCustomId,
  CreateCategorySelectCustomId,
  CreateOverviewCustomId,
} from "@commands/Utility/Help/HelpTypes";

export function CreateOverviewPayload(
  categories: CategoryView[],
  interactionId: string,
): OverviewPayload {
  const totalCommands = categories.reduce(
    (sum, category) => sum + category.commands.length,
    0,
  );

  const embed = EmbedFactory.CreateHelpOverview(
    totalCommands,
    categories.length,
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

export function BuildCategoryRows(
  categories: CategoryView[],
  interactionId: string,
  activeKey?: string,
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
      }).toJSON() as ActionRowData<ActionRowComponentData>,
  );
}

export function BuildPaginationRow(
  interactionId: string,
  categoryKey: string,
  pageIndex: number,
  totalPages: number,
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
        "first",
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
        pageIndex,
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
        pageIndex,
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
        totalPages - 1,
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
