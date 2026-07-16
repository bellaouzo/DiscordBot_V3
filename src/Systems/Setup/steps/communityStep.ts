import type { ActionRowComponentData, ActionRowData } from "discord.js";
import { EmbedFactory } from "@utilities";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
} from "../constants";
import {
  BuildChannelSelectRow,
  BuildSingleRoleSelectRow,
} from "../builders/components";
import { BuildNavigationRow } from "../builders/navigation";
import {
  FormatChannel,
  FormatChannelAllowNone,
  FormatSingleRole,
} from "../builders/formatters";
import { SETUP_STEP_COUNT } from "../constants";
import type { SetupStepDefinition } from "./types";
import { BuildStepFooter } from "./types";

export const communityStep: SetupStepDefinition = {
  id: "community",
  title: "Community",
  subtitle: "Community Channels",
  buildEmbed(context) {
    const { draft } = context;
    const embed = EmbedFactory.Create({
      title: "Community Channels",
      description:
        "Optional channels for announcements, welcome messages, and enabled feature modules.",
      color: 0x5865f2,
    });

    const fields = [
      {
        name: "Delete Logs",
        value: FormatChannel(
          draft.deleteLogChannelId,
          context.guild,
          context.loggingDefaults.messageDeleteChannelName ||
            DEFAULT_DELETE_LOG_CHANNEL,
        ),
        inline: true,
      },
      {
        name: "Announcements",
        value: FormatChannel(
          draft.announcementChannelId,
          context.guild,
          DEFAULT_ANNOUNCEMENT_CHANNEL,
        ),
        inline: true,
      },
      {
        name: "Welcome Channel",
        value: FormatChannel(draft.welcomeChannelId, context.guild, "welcome"),
        inline: true,
      },
      {
        name: "Production Logs",
        value: FormatChannelAllowNone(
          draft.productionLogChannelId,
          context.guild,
          context.loggingDefaults.deployLogChannelName ||
            DEFAULT_PRODUCTION_LOG_CHANNEL,
        ),
        inline: true,
      },
    ];

    if (draft.starboardEnabled) {
      fields.push({
        name: "Starboard Channel",
        value: FormatChannel(
          draft.starboardChannelId,
          context.guild,
          "starboard",
        ),
        inline: true,
      });
    }

    if (draft.levelingEnabled) {
      fields.push({
        name: "Level-up Channel",
        value: FormatChannel(draft.levelUpChannelId, context.guild, "level-up"),
        inline: true,
      });
    }

    if (draft.verificationEnabled) {
      fields.push(
        {
          name: "Verification Channel",
          value: FormatChannel(
            draft.verificationChannelId,
            context.guild,
            "verification",
          ),
          inline: true,
        },
        {
          name: "Unverified Role",
          value: `${FormatSingleRole(draft.unverifiedRoleId, context.guild)}\n*Required — assigned on join*`,
          inline: true,
        },
        {
          name: "Verified Role",
          value: `${FormatSingleRole(draft.verifiedRoleId, context.guild)}\n*Optional — granted after verify*`,
          inline: true,
        },
      );
    }

    embed.addFields(fields);
    embed.setFooter({
      text: BuildStepFooter(5, SETUP_STEP_COUNT, "Community Channels"),
    });
    return embed;
  },
  buildComponents(context) {
    const { draft } = context;
    const contentRows: ActionRowData<ActionRowComponentData>[] = [];

    if (draft.verificationEnabled) {
      contentRows.push(
        BuildChannelSelectRow({
          customId: context.ids.verificationChannelSelect,
          channels: context.resources.textChannels,
          selectedId: draft.verificationChannelId,
          placeholder:
            "Verification channel — where the verify panel is posted",
          fieldLabel: "Verification channel",
          defaultName: "verification",
        }),
        BuildSingleRoleSelectRow({
          customId: context.ids.unverifiedRoleSelect,
          placeholder: "Unverified role — given on join (required)",
          fieldLabel: "Unverified role",
          roles: context.resources.roles,
          selectedId: draft.unverifiedRoleId,
          allowNone: true,
        }),
        BuildSingleRoleSelectRow({
          customId: context.ids.verifiedRoleSelect,
          placeholder: "Verified role — granted after verifying (optional)",
          fieldLabel: "Verified role",
          roles: context.resources.roles,
          selectedId: draft.verifiedRoleId,
          allowNone: true,
        }),
      );
    }

    const optionalRows = [
      BuildChannelSelectRow({
        customId: context.ids.deleteLogSelect,
        channels: context.resources.textChannels,
        selectedId: draft.deleteLogChannelId,
        placeholder: "Delete logs channel — message deletion audit log",
        fieldLabel: "Delete logs",
        defaultName:
          context.loggingDefaults.messageDeleteChannelName ||
          DEFAULT_DELETE_LOG_CHANNEL,
        allowNone: true,
      }),
      BuildChannelSelectRow({
        customId: context.ids.announcementSelect,
        channels: context.resources.textChannels,
        selectedId: draft.announcementChannelId,
        placeholder: "Announcements channel — default for /announce",
        fieldLabel: "Announcements",
        defaultName: DEFAULT_ANNOUNCEMENT_CHANNEL,
      }),
      BuildChannelSelectRow({
        customId: context.ids.welcomeSelect,
        channels: context.resources.textChannels,
        selectedId: draft.welcomeChannelId,
        placeholder: "Welcome channel — join messages go here",
        fieldLabel: "Welcome channel",
        defaultName: "welcome",
      }),
      BuildChannelSelectRow({
        customId: context.ids.productionLogSelect,
        channels: context.resources.textChannels,
        selectedId: draft.productionLogChannelId,
        placeholder: "Production logs channel — or disable",
        fieldLabel: "Production logs",
        defaultName:
          context.loggingDefaults.deployLogChannelName ||
          DEFAULT_PRODUCTION_LOG_CHANNEL,
        allowNone: true,
      }),
    ];

    if (draft.starboardEnabled) {
      optionalRows.push(
        BuildChannelSelectRow({
          customId: context.ids.starboardChannelSelect,
          channels: context.resources.textChannels,
          selectedId: draft.starboardChannelId,
          placeholder: "Starboard channel — popular messages are reposted here",
          fieldLabel: "Starboard channel",
          defaultName: "starboard",
        }),
      );
    }

    if (draft.levelingEnabled) {
      optionalRows.push(
        BuildChannelSelectRow({
          customId: context.ids.levelUpChannelSelect,
          channels: context.resources.textChannels,
          selectedId: draft.levelUpChannelId,
          placeholder: "Level-up channel — rank-up announcements",
          fieldLabel: "Level-up channel",
          defaultName: "level-up",
          allowNone: true,
        }),
      );
    }

    for (const row of optionalRows) {
      if (contentRows.length >= 4) {
        break;
      }
      contentRows.push(row);
    }

    contentRows.push(BuildNavigationRow({ step: 5, ids: context.ids }));
    return contentRows.slice(0, 5);
  },
};
