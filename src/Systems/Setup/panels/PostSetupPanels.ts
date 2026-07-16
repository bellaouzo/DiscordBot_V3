import type { Guild, TextChannel } from "discord.js";
import { ChannelType, GuildFeature } from "discord.js";
import type { GuildSettings } from "@database/Server/Types";
import type { Logger } from "@shared/Logger";
import type { CreateChannelManager } from "@utilities";
import {
  APPEAL_PANEL_BUTTON_CUSTOM_ID,
  PostAppealPanelToChannel,
} from "@commands/Moderation/Appeal/AppealPanelFlow";
import {
  PANEL_BUTTON_CUSTOM_ID as TICKET_PANEL_BUTTON_CUSTOM_ID,
  PostTicketPanelToChannel,
} from "@systems/Ticket/TicketPanelFlow";
import {
  VERIFICATION_PANEL_BEGIN_CUSTOM_ID,
  PostVerificationPanelToChannel,
} from "@systems/Verification/VerificationPanelFlow";
import {
  DEFAULT_APPEAL_PANEL_CHANNEL,
  DEFAULT_RULES_PANEL_CHANNEL,
  DEFAULT_TICKET_PANEL_CHANNEL,
} from "../constants";
import {
  ChannelHasEmbedFooterMarker,
  ChannelHasPanelButton,
} from "./PanelPresence";
import { FetchGuildServerRules } from "./FetchGuildServerRules";
import {
  PostRulesPanelToChannel,
  RULES_PANEL_FOOTER_MARKER,
} from "./RulesPanel";

export type SetupPanelResultStatus =
  | "posted"
  | "already_posted"
  | "skipped"
  | "failed";

export interface SetupPanelResult {
  readonly id: "verification" | "ticket" | "appeal" | "rules";
  readonly label: string;
  readonly status: SetupPanelResultStatus;
  readonly channelId?: string;
  readonly detail?: string;
}

interface PostMissingSetupPanelsOptions {
  readonly guild: Guild;
  readonly settings: GuildSettings;
  readonly channelManager: ReturnType<typeof CreateChannelManager>;
  readonly logger: Logger;
}

async function ResolveTextChannel(
  guild: Guild,
  channelId: string | null,
): Promise<TextChannel | null> {
  if (!channelId) {
    return null;
  }

  try {
    const channel = await guild.channels.fetch(channelId);
    if (
      channel &&
      channel.type === ChannelType.GuildText &&
      channel.isTextBased()
    ) {
      return channel as TextChannel;
    }
  } catch {
    return null;
  }

  return null;
}

async function ResolveRulesChannel(
  guild: Guild,
  channelManager: ReturnType<typeof CreateChannelManager>,
): Promise<TextChannel | null> {
  const existingRulesChannel = await ResolveTextChannel(
    guild,
    guild.rulesChannelId,
  );
  if (existingRulesChannel) {
    return existingRulesChannel;
  }

  const created = await channelManager.GetOrCreateTextChannel(
    DEFAULT_RULES_PANEL_CHANNEL,
  );
  if (!created) {
    return null;
  }

  if (
    !guild.rulesChannelId &&
    guild.features.includes(GuildFeature.Community)
  ) {
    try {
      await guild.setRulesChannel(
        created,
        "Setup configured the server rules channel",
      );
    } catch {
      // Optional — Community rules channel update may fail without Manage Guild.
    }
  }

  return created;
}

async function EnsurePanelInChannel(options: {
  channel: TextChannel;
  customIds: readonly string[];
  post: () => Promise<void>;
  label: string;
  id: SetupPanelResult["id"];
  logger: Logger;
}): Promise<SetupPanelResult> {
  try {
    const alreadyPosted = await ChannelHasPanelButton(
      options.channel,
      options.customIds,
    );

    if (alreadyPosted) {
      return {
        id: options.id,
        label: options.label,
        status: "already_posted",
        channelId: options.channel.id,
      };
    }

    await options.post();
    return {
      id: options.id,
      label: options.label,
      status: "posted",
      channelId: options.channel.id,
    };
  } catch (error) {
    options.logger.Warn("Failed to post setup panel", {
      error,
      extra: {
        guildId: options.channel.guildId,
        panel: options.id,
        channelId: options.channel.id,
      },
    });
    return {
      id: options.id,
      label: options.label,
      status: "failed",
      channelId: options.channel.id,
      detail: "Check bot permissions in that channel.",
    };
  }
}

async function EnsureRulesPanel(options: {
  guild: Guild;
  channelManager: ReturnType<typeof CreateChannelManager>;
  logger: Logger;
}): Promise<SetupPanelResult> {
  const serverRules = await FetchGuildServerRules({
    guild: options.guild,
    logger: options.logger,
  });

  if (!serverRules) {
    return {
      id: "rules",
      label: "Rules panel",
      status: "skipped",
      detail:
        "No Discord Server Rules found. Set them in Server Settings → Safety → Server Rules.",
    };
  }

  const channel = await ResolveRulesChannel(
    options.guild,
    options.channelManager,
  );
  if (!channel) {
    return {
      id: "rules",
      label: "Rules panel",
      status: "failed",
      detail: `Could not create or find #${DEFAULT_RULES_PANEL_CHANNEL}.`,
    };
  }

  try {
    const alreadyPosted = await ChannelHasEmbedFooterMarker(
      channel,
      RULES_PANEL_FOOTER_MARKER,
    );
    if (alreadyPosted) {
      return {
        id: "rules",
        label: "Rules panel",
        status: "already_posted",
        channelId: channel.id,
      };
    }

    await PostRulesPanelToChannel({
      channel,
      guild: options.guild,
      serverRules,
    });

    return {
      id: "rules",
      label: "Rules panel",
      status: "posted",
      channelId: channel.id,
    };
  } catch (error) {
    options.logger.Warn("Failed to post rules panel", {
      error,
      extra: { guildId: options.guild.id, channelId: channel.id },
    });
    return {
      id: "rules",
      label: "Rules panel",
      status: "failed",
      channelId: channel.id,
      detail: "Check bot permissions in that channel.",
    };
  }
}

export async function PostMissingSetupPanels(
  options: PostMissingSetupPanelsOptions,
): Promise<SetupPanelResult[]> {
  const { guild, settings, channelManager, logger } = options;
  const results: SetupPanelResult[] = [];

  results.push(
    await EnsureRulesPanel({
      guild,
      channelManager,
      logger,
    }),
  );

  if (settings.verification_enabled) {
    if (!settings.unverified_role_id) {
      results.push({
        id: "verification",
        label: "Verification panel",
        status: "skipped",
        detail: "Unverified role is not configured.",
      });
    } else if (!settings.verification_channel_id) {
      results.push({
        id: "verification",
        label: "Verification panel",
        status: "skipped",
        detail: "Verification channel is not configured.",
      });
    } else {
      const channel = await ResolveTextChannel(
        guild,
        settings.verification_channel_id,
      );
      if (!channel) {
        results.push({
          id: "verification",
          label: "Verification panel",
          status: "failed",
          channelId: settings.verification_channel_id,
          detail: "Verification channel could not be found.",
        });
      } else {
        results.push(
          await EnsurePanelInChannel({
            channel,
            customIds: [VERIFICATION_PANEL_BEGIN_CUSTOM_ID],
            label: "Verification panel",
            id: "verification",
            logger,
            post: async () => {
              await PostVerificationPanelToChannel({
                channel,
                guild,
                settings,
              });
            },
          }),
        );
      }
    }
  }

  const ticketChannel = await channelManager.GetOrCreateTextChannel(
    DEFAULT_TICKET_PANEL_CHANNEL,
  );
  if (!ticketChannel) {
    results.push({
      id: "ticket",
      label: "Ticket panel",
      status: "failed",
      detail: `Could not create or find #${DEFAULT_TICKET_PANEL_CHANNEL}.`,
    });
  } else {
    results.push(
      await EnsurePanelInChannel({
        channel: ticketChannel,
        customIds: [TICKET_PANEL_BUTTON_CUSTOM_ID],
        label: "Ticket panel",
        id: "ticket",
        logger,
        post: async () => {
          await PostTicketPanelToChannel(ticketChannel);
        },
      }),
    );
  }

  const appealChannel = await channelManager.GetOrCreateTextChannel(
    DEFAULT_APPEAL_PANEL_CHANNEL,
  );
  if (!appealChannel) {
    results.push({
      id: "appeal",
      label: "Appeal panel",
      status: "failed",
      detail: `Could not create or find #${DEFAULT_APPEAL_PANEL_CHANNEL}.`,
    });
  } else {
    results.push(
      await EnsurePanelInChannel({
        channel: appealChannel,
        customIds: [APPEAL_PANEL_BUTTON_CUSTOM_ID],
        label: "Appeal panel",
        id: "appeal",
        logger,
        post: async () => {
          await PostAppealPanelToChannel(appealChannel);
        },
      }),
    );
  }

  return results;
}

export function FormatSetupPanelResults(
  results: readonly SetupPanelResult[],
): string[] {
  if (results.length === 0) {
    return [];
  }

  return results.map((result) => {
    const channelMention = result.channelId ? ` in <#${result.channelId}>` : "";

    switch (result.status) {
      case "posted":
        return `• Posted ${result.label}${channelMention}`;
      case "already_posted":
        return `• ${result.label} already posted${channelMention}`;
      case "skipped":
        return `• Skipped ${result.label}${result.detail ? ` — ${result.detail}` : ""}`;
      case "failed":
        return `• Failed to post ${result.label}${result.detail ? ` — ${result.detail}` : ""}`;
    }
  });
}
