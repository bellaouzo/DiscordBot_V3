import type { APIEmbed } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "./index";
import type { AppConfig } from "@config/AppConfig";
import { IsBotOwner } from "@config/AppConfig";
import type { BlocklistEntry, ServerDatabase } from "@database/ServerDatabase";
import { EmbedFactory } from "@utilities";

export interface BlocklistMatch {
  readonly entry: BlocklistEntry;
  readonly title: string;
  readonly description: string;
}

/**
 * Looks the user and guild up in the global blocklist. Bot owners are never blocked.
 * Shared by the command middleware and the component/modal dispatcher.
 */
export function FindBlocklistMatch(options: {
  readonly userId: string;
  readonly guildId: string | null;
  readonly serverDb: ServerDatabase;
  readonly appConfig: AppConfig;
}): BlocklistMatch | null {
  if (IsBotOwner(options.userId, options.appConfig)) {
    return null;
  }

  const userEntry = options.serverDb.GetBlocklistEntry("user", options.userId);
  if (userEntry) {
    return {
      entry: userEntry,
      title: "Access Blocked",
      description: "You are blocked from using this bot.",
    };
  }

  if (options.guildId) {
    const guildEntry = options.serverDb.GetBlocklistEntry(
      "guild",
      options.guildId,
    );
    if (guildEntry) {
      return {
        entry: guildEntry,
        title: "Unavailable",
        description: "This bot is not available in this server.",
      };
    }
  }

  return null;
}

/**
 * Builds the ephemeral reply sent to a blocklisted user or guild.
 */
export function CreateBlocklistReply(match: BlocklistMatch): {
  embeds: APIEmbed[];
  flags: MessageFlags.Ephemeral;
} {
  const embed = EmbedFactory.CreateError({
    title: match.title,
    description: match.description,
  });
  return { embeds: [embed.toJSON()], flags: MessageFlags.Ephemeral };
}

/**
 * Rejects commands from blocklisted users and guilds before any other work is done.
 */
export const BlocklistMiddleware: CommandMiddleware = {
  name: "blocklist",
  execute: async (context, next) => {
    const match = FindBlocklistMatch({
      userId: context.interaction.user.id,
      guildId: context.interaction.guildId,
      serverDb: context.databases.serverDb,
      appConfig: context.appConfig,
    });

    if (!match) {
      await next();
      return;
    }

    context.logger.Debug("Command blocked by blocklist", {
      command: context.invocation.path,
      extra: {
        targetType: match.entry.target_type,
        targetId: match.entry.target_id,
      },
    });

    await context.responders.interactionResponder.Reply(
      context.interaction,
      CreateBlocklistReply(match),
    );
  },
};
