import type { ButtonInteraction } from "discord.js";
import type { CommandContext } from "@commands";
import type { ButtonResponder } from "@responders";
import type { CategoryView } from "@commands/Utility/Help/HelpTypes";
import {
  BuildCategoryRows,
  BuildPaginationRow,
  CreateOverviewPayload,
} from "@commands/Utility/Help/HelpComponents";
import {
  CreateCategorySelectCustomId,
  CreateOverviewCustomId,
  HELP_SESSION_TIMEOUT_MS,
  ParseCategoryPageNavCustomId,
  ResolveHelpPageIndex,
} from "@commands/Utility/Help/HelpTypes";

export function RegisterHelpButtons(options: {
  readonly categories: CategoryView[];
  readonly componentRouter: CommandContext["responders"]["componentRouter"];
  readonly buttonResponder: ButtonResponder;
  readonly interaction: { id: string; user: { id: string } };
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
    expiresInMs: HELP_SESSION_TIMEOUT_MS,
  });

  categories.forEach((category) => {
    componentRouter.RegisterButton({
      customId: CreateCategorySelectCustomId(interactionId, category.key),
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
      expiresInMs: HELP_SESSION_TIMEOUT_MS,
    });

    componentRouter.RegisterButtonPrefix(
      `help:${interactionId}:page:${category.key}:`,
      {
        ownerId,
        handler: async (buttonInteraction) => {
          const parsed = ParseCategoryPageNavCustomId(
            buttonInteraction.customId,
          );
          if (!parsed) {
            return;
          }

          await ShowCategoryPage({
            buttonInteraction,
            buttonResponder,
            categories,
            category,
            interactionId,
            pageIndex: ResolveHelpPageIndex(
              parsed.action,
              parsed.pageIndex,
              category.pages.length,
            ),
          });
        },
        expiresInMs: HELP_SESSION_TIMEOUT_MS,
      },
    );
  });
}

export async function ShowCategoryPage(options: {
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
