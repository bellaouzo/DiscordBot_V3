import { EmbedFactory } from "@utilities";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_APPEAL_CATEGORY,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  DEFAULT_TICKET_CATEGORY,
} from "../constants";
import {
  FEATURE_MODULES,
  GetDraftFeatureEnabled,
} from "../features/FeatureModules";
import { BuildNavigationRow } from "../builders/navigation";
import {
  FormatCategory,
  FormatChannel,
  FormatChannelAllowNone,
  FormatModuleStatus,
  FormatRoleList,
  FormatSingleRole,
} from "../builders/formatters";
import { ValidateSetupDraft } from "../persistence/SaveSetupDraft";
import { SETUP_STEP_COUNT } from "../constants";
import type { SetupStepDefinition } from "./types";
import { BuildStepFooter } from "./types";

export const reviewStep: SetupStepDefinition = {
  id: "review",
  title: "Review & Save",
  subtitle: "Review & Save",
  buildEmbed(context) {
    const { draft, guild, loggingDefaults } = context;
    const embed = EmbedFactory.Create({
      title: "Review & Save",
      description:
        "Confirm your configuration below, then choose **Save & Finish**.",
      color: 0x5865f2,
    });

    embed.addFields(
      {
        name: "Staff",
        value: [
          `**Admin:** ${FormatRoleList(draft.adminRoleIds, guild, true)}`,
          `**Mod:** ${FormatRoleList(draft.modRoleIds, guild)}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Feature Modules",
        value: FEATURE_MODULES.map(
          (module) =>
            `${module.emoji} ${module.label}: ${FormatModuleStatus(GetDraftFeatureEnabled(draft, module.id))}`,
        ).join("\n"),
        inline: false,
      },
      {
        name: "Support & Logging",
        value: [
          `Tickets: ${FormatCategory(draft.ticketCategoryId, guild, DEFAULT_TICKET_CATEGORY)}`,
          `Appeals: ${FormatCategory(draft.appealReviewCategoryId, guild, DEFAULT_APPEAL_CATEGORY)}`,
          `Command logs: ${FormatChannel(draft.commandLogChannelId, guild, loggingDefaults.commandLogChannelName)}`,
          `Ticket logs: ${FormatChannel(draft.ticketLogChannelId, guild, "ticket-logs")}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Community",
        value: [
          `Announcements: ${FormatChannel(draft.announcementChannelId, guild, DEFAULT_ANNOUNCEMENT_CHANNEL)}`,
          `Welcome: ${FormatChannel(draft.welcomeChannelId, guild, "welcome")}`,
          `Production logs: ${FormatChannelAllowNone(draft.productionLogChannelId, guild, loggingDefaults.deployLogChannelName || DEFAULT_PRODUCTION_LOG_CHANNEL)}`,
          draft.starboardEnabled
            ? `Starboard: ${FormatChannel(draft.starboardChannelId, guild, "starboard")}`
            : "Starboard: disabled",
          draft.levelingEnabled
            ? `Level-up: ${FormatChannel(draft.levelUpChannelId, guild, "level-up")}`
            : "Level-up: disabled",
          draft.verificationEnabled
            ? `Verification: ${FormatChannel(draft.verificationChannelId, guild, "verification")} · ${FormatSingleRole(draft.unverifiedRoleId, guild)}`
            : "Verification: disabled",
        ].join("\n"),
        inline: false,
      },
    );

    const validation = ValidateSetupDraft(draft);
    if (validation.warnings.length > 0) {
      embed.addFields({
        name: "Warnings",
        value: validation.warnings.map((warning) => `• ${warning}`).join("\n"),
        inline: false,
      });
    }

    if (validation.error) {
      embed.addFields({
        name: "Cannot Save Yet",
        value: validation.error,
        inline: false,
      });
    }

    embed.setFooter({
      text: BuildStepFooter(6, SETUP_STEP_COUNT, "Review & Save"),
    });
    return embed;
  },
  buildComponents(context) {
    return [BuildNavigationRow({ step: 6, ids: context.ids })];
  },
};
