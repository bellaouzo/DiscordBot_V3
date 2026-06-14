import { EmbedFactory } from "@utilities";
import {
  DEFAULT_APPEAL_CATEGORY,
  DEFAULT_TICKET_CATEGORY,
} from "../constants";
import {
  BuildCategorySelectRow,
  BuildChannelSelectRow,
} from "../builders/components";
import { BuildNavigationRow } from "../builders/navigation";
import {
  FormatCategory,
  FormatChannel,
} from "../builders/formatters";
import { SETUP_STEP_COUNT } from "../constants";
import type { SetupStepDefinition } from "./types";
import { BuildStepFooter } from "./types";

export const supportLoggingStep: SetupStepDefinition = {
  id: "support-logging",
  title: "Support & Logging",
  subtitle: "Support & Logging",
  buildEmbed(context) {
    const embed = EmbedFactory.Create({
      title: "Support & Logging",
      description: "Configure ticket/appeal categories and moderation log channels.",
      color: 0x5865f2,
    });

    embed.addFields(
      {
        name: "Ticket Category",
        value: FormatCategory(
          context.draft.ticketCategoryId,
          context.guild,
          DEFAULT_TICKET_CATEGORY,
        ),
        inline: false,
      },
      {
        name: "Appeal Category",
        value: FormatCategory(
          context.draft.appealReviewCategoryId,
          context.guild,
          DEFAULT_APPEAL_CATEGORY,
        ),
        inline: false,
      },
      {
        name: "Command Logs",
        value: FormatChannel(
          context.draft.commandLogChannelId,
          context.guild,
          context.loggingDefaults.commandLogChannelName,
        ),
        inline: true,
      },
      {
        name: "Delete Logs",
        value: "Configured on the Community step",
        inline: true,
      },
      {
        name: "Ticket Logs",
        value: FormatChannel(
          context.draft.ticketLogChannelId,
          context.guild,
          "ticket-logs",
        ),
        inline: true,
      },
    );

    embed.setFooter({
      text: BuildStepFooter(4, SETUP_STEP_COUNT, "Support & Logging"),
    });
    return embed;
  },
  buildComponents(context) {
    return [
      BuildCategorySelectRow({
        customId: context.ids.ticketSelect,
        categories: context.resources.categories,
        selectedId: context.draft.ticketCategoryId,
        placeholder: "Ticket category for new ticket channels",
        defaultCategoryName: DEFAULT_TICKET_CATEGORY,
      }),
      BuildCategorySelectRow({
        customId: context.ids.appealSelect,
        categories: context.resources.categories,
        selectedId: context.draft.appealReviewCategoryId,
        placeholder: "Appeal category for review channels",
        defaultCategoryName: DEFAULT_APPEAL_CATEGORY,
      }),
      BuildChannelSelectRow({
        customId: context.ids.commandLogSelect,
        channels: context.resources.textChannels,
        selectedId: context.draft.commandLogChannelId,
        placeholder: "Choose a command log channel",
        defaultName: context.loggingDefaults.commandLogChannelName,
        includeCategoryName: context.loggingDefaults.commandLogCategoryName,
      }),
      BuildChannelSelectRow({
        customId: context.ids.ticketLogSelect,
        channels: context.resources.textChannels,
        selectedId: context.draft.ticketLogChannelId,
        placeholder: "Choose a ticket logs channel",
        defaultName: "ticket-logs",
      }),
      BuildNavigationRow({ step: 4, ids: context.ids }),
    ];
  },
};
