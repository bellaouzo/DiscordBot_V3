import { ButtonStyle } from "discord.js";
import type { ActionRowComponentData, ActionRowData } from "discord.js";
import { ComponentFactory, EmbedFactory, ToActionRowData } from "@utilities";
import {
  FEATURE_MODULES,
  FormatFeatureToggleLabel,
  GetDraftFeatureEnabled,
} from "../features/FeatureModules";
import { BuildNavigationRow } from "../builders/navigation";
import { BuildRoleSelectRow } from "../builders/components";
import { FormatRoleList, FormatFeatureModulesOverview } from "../builders/formatters";
import { SETUP_STEP_COUNT } from "../constants";
import type { SetupStepDefinition } from "./types";
import { BuildStepFooter } from "./types";

export const welcomeStep: SetupStepDefinition = {
  id: "welcome",
  title: "Welcome",
  subtitle: "Welcome",
  buildEmbed() {
    const embed = EmbedFactory.Create({
      title: "Server Setup",
      description:
        "Configure your server in a few guided steps. You can change anything later by running `/setup` again.",
      color: 0x5865f2,
    });

    embed.addFields(
      {
        name: "What you'll configure",
        value: [
          "• Staff roles for admin and moderation",
          "• Feature modules (economy, leveling, starboard, and more)",
          "• Support categories and logging channels",
          "• Community channels and verification",
        ].join("\n"),
        inline: false,
      },
      {
        name: "Tip",
        value: "Use **Get Started** when you're ready. All changes stay in this session until you save on the final step.",
        inline: false,
      },
    );

    embed.setFooter({
      text: BuildStepFooter(1, SETUP_STEP_COUNT, "Welcome"),
    });

    return embed;
  },
  buildComponents(context) {
    return [BuildNavigationRow({ step: 1, ids: context.ids })];
  },
};

export const staffStep: SetupStepDefinition = {
  id: "staff",
  title: "Staff & Roles",
  subtitle: "Staff & Roles",
  buildEmbed(context) {
    const embed = EmbedFactory.Create({
      title: "Staff & Roles",
      description: "Choose who can run admin and moderation commands.",
      color: 0x5865f2,
    });

    embed.addFields(
      {
        name: "Admin Roles",
        value: FormatRoleList(context.draft.adminRoleIds, context.guild, true),
        inline: true,
      },
      {
        name: "Mod Roles",
        value: FormatRoleList(context.draft.modRoleIds, context.guild),
        inline: true,
      },
    );

    embed.setFooter({
      text: BuildStepFooter(2, SETUP_STEP_COUNT, "Staff & Roles"),
    });
    return embed;
  },
  buildComponents(context) {
    return [
      BuildRoleSelectRow(
        context.ids.adminSelect,
        "Admin roles — full access",
        context.resources.roles,
        context.draft.adminRoleIds,
        "Admin Roles",
      ),
      BuildRoleSelectRow(
        context.ids.modSelect,
        "Mod roles — day-to-day moderation",
        context.resources.roles,
        context.draft.modRoleIds,
        "Mod Roles",
      ),
      BuildNavigationRow({ step: 2, ids: context.ids }),
    ];
  },
};

export const featuresStep: SetupStepDefinition = {
  id: "features",
  title: "Feature Modules",
  subtitle: "Feature Modules",
  buildEmbed(context) {
    const embed = EmbedFactory.Create({
      title: "Feature Modules",
      description:
        "Turn bot features on or off for this server. Use the toggle buttons below — channel settings for enabled modules come on the next step.",
      color: 0x5865f2,
    });

    embed.addFields({
      name: "Current settings",
      value: FormatFeatureModulesOverview(
        FEATURE_MODULES.map((module) => ({
          emoji: module.emoji,
          label: module.label,
          description: module.description,
          enabled: GetDraftFeatureEnabled(context.draft, module.id),
        })),
      ),
      inline: false,
    });

    embed.setFooter({
      text: BuildStepFooter(3, SETUP_STEP_COUNT, "Feature Modules"),
    });
    return embed;
  },
  buildComponents(context) {
    const rows: ActionRowData<ActionRowComponentData>[] = [];
    const togglePairs = [
      FEATURE_MODULES.slice(0, 2),
      FEATURE_MODULES.slice(2, 4),
      [FEATURE_MODULES[4]!],
    ];

    togglePairs.forEach((pair) => {
      const buttons = pair.map((module) => {
        const enabled = GetDraftFeatureEnabled(context.draft, module.id);
        return {
          label: FormatFeatureToggleLabel(module, enabled).slice(0, 80),
          style: enabled ? ButtonStyle.Success : ButtonStyle.Danger,
          emoji: module.emoji,
        };
      });
      const customIds = pair.map(
        (module) => context.ids.featureToggleIds[module.id],
      );
      rows.push(
        ToActionRowData(
          ComponentFactory.CreateActionRow({ buttons, customIds }),
        ) as ActionRowData<ActionRowComponentData>,
      );
    });

    rows.push(BuildNavigationRow({ step: 3, ids: context.ids }));
    return rows;
  },
};
