import {
  ChatInputCommandInteraction,
  Role,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { EmbedFactory } from "@utilities";
import { LoadAppConfig } from "@config/AppConfig";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  DEFAULT_TICKET_CATEGORY,
} from "../constants";
import { SetupDraft } from "../state";

function FormatRoleList(
  roleIds: string[],
  guild: ChatInputCommandInteraction["guild"]
): string {
  if (!roleIds || roleIds.length === 0) {
    return "No roles selected (required)";
  }

  const mentions = roleIds
    .map((id) => guild?.roles.cache.get(id))
    .filter((role): role is Role => Boolean(role))
    .map((role) => role.toString());

  if (mentions.length === 0) {
    return "Roles not found (they may have been deleted)";
  }

  return mentions.join(", ");
}

function FormatCategory(
  categoryId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string
): string {
  if (!categoryId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const category = guild?.channels.cache.get(categoryId) as
    | CategoryChannel
    | undefined;
  return category
    ? `${category.name} (${categoryId})`
    : `Category ID: ${categoryId}`;
}

function FormatChannel(
  channelId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string
): string {
  if (!channelId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const channel = guild?.channels.cache.get(channelId) as
    | TextChannel
    | undefined;
  return channel ? channel.toString() : `Channel ID: ${channelId}`;
}

function FormatChannelAllowNone(
  channelId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string
): string {
  if (channelId === null) {
    return "Disabled";
  }

  return FormatChannel(channelId, guild, fallbackName);
}

export function BuildSetupEmbed(options: {
  draft: SetupDraft;
  step: number;
  guild: ChatInputCommandInteraction["guild"];
  loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
}) {
  const { draft, step, guild, loggingDefaults } = options;

  let description = "Use the menus below to pick roles and channels.";
  if (step < 3) {
    description += `\n\n**📄 More settings available on the next ${step === 1 ? "2" : "1"} page${step === 1 ? "s" : ""}**`;
  }

  const embed = EmbedFactory.Create({
    title: `Server Setup — Step ${step}/3`,
    description,
    color: 0x5865f2,
  });

  const fields = [];

  if (step === 1) {
    fields.push(
      {
        name: "Admin Roles",
        value: FormatRoleList(draft.adminRoleIds, guild),
        inline: true,
      },
      {
        name: "Mod Roles",
        value: FormatRoleList(draft.modRoleIds, guild),
        inline: true,
      }
    );
  } else if (step === 2) {
    fields.push(
      {
        name: "Ticket Category",
        value: FormatCategory(
          draft.ticketCategoryId,
          guild,
          DEFAULT_TICKET_CATEGORY
        ),
        inline: false,
      },
      {
        name: "Delete Logs",
        value: FormatChannel(
          draft.deleteLogChannelId,
          guild,
          loggingDefaults.messageDeleteChannelName || DEFAULT_DELETE_LOG_CHANNEL
        ),
        inline: true,
      },
      {
        name: "Command Logs",
        value: FormatChannel(
          draft.commandLogChannelId,
          guild,
          loggingDefaults.commandLogChannelName
        ),
        inline: true,
      }
    );
  } else if (step === 3) {
    fields.push(
      {
        name: "Announcements",
        value: FormatChannel(
          draft.announcementChannelId,
          guild,
          DEFAULT_ANNOUNCEMENT_CHANNEL
        ),
        inline: true,
      },
      {
        name: "Production Logs",
        value: FormatChannelAllowNone(
          draft.productionLogChannelId,
          guild,
          loggingDefaults.deployLogChannelName || DEFAULT_PRODUCTION_LOG_CHANNEL
        ),
        inline: true,
      },
      {
        name: "Welcome Channel",
        value: FormatChannel(draft.welcomeChannelId, guild, "welcome"),
        inline: true,
      }
    );
  }

  embed.addFields(fields);

  return embed;
}
