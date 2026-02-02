import { Events } from "discord.js";
import { CreateEvent, EventContext } from "../EventFactory";
import {
  CreateChannelManager,
  EmbedFactory,
  SafeParseJson,
  isRecord,
} from "@utilities";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { ActivityType } from "discord.js";

interface DeployInfo {
  hash: string;
  message: string;
  timestamp: string;
}

function isDeployInfo(data: unknown): data is DeployInfo {
  if (!isRecord(data)) return false;
  return (
    typeof data.hash === "string" &&
    typeof data.message === "string" &&
    typeof data.timestamp === "string"
  );
}

const DEPLOY_INFO_PATH = join(process.cwd(), "data", "deploy-info.json");
const REPO_URL = "https://github.com/bellaouzo/DiscordBot_V3";

function ReadDeployInfo(logger: EventContext["logger"]): DeployInfo | null {
  if (!existsSync(DEPLOY_INFO_PATH)) {
    return null;
  }

  const raw = readFileSync(DEPLOY_INFO_PATH, "utf8");
  const result = SafeParseJson(raw, isDeployInfo);
  if (!result.success || !result.data) {
    logger.Warn("Failed to read deploy info file", {
      error: result.error,
      extra: { path: DEPLOY_INFO_PATH },
    });
    return null;
  }
  return result.data;
}

function ClearDeployInfo(logger: EventContext["logger"]): void {
  try {
    if (existsSync(DEPLOY_INFO_PATH)) {
      unlinkSync(DEPLOY_INFO_PATH);
    }
  } catch (error) {
    logger.Warn("Failed to clear deploy info file", {
      error,
      extra: { path: DEPLOY_INFO_PATH },
    });
  }
}

async function AnnounceDeploy(context: EventContext): Promise<void> {
  const info = ReadDeployInfo(context.logger);
  if (!info) {
    return;
  }

  const truncate = (text: string, max = 450): string =>
    text.length <= max ? text : `${text.slice(0, max - 1)}…`;

  const formatMessage = (raw: string): string => {
    const cleaned = raw.trim();
    if (!cleaned.includes(" - ")) {
      return truncate(cleaned);
    }
    const parts = cleaned
      .split(" - ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return "No message";
    const [headline, ...rest] = parts;
    const lines: string[] = [`**${headline}**`];
    if (rest.length) {
      lines.push(""); // blank line between headline and bullets
      lines.push(...rest.map((p) => `• ${p}`));
    }
    return truncate(lines.join("\n"));
  };

  const sentGuilds: string[] = [];
  const commitUrl = `${REPO_URL}/commit/${info.hash}`;

  for (const guild of context.client.guilds.cache.values()) {
    const channelManager = CreateChannelManager({
      guild,
      logger: context.logger,
    });

    const channel = await channelManager.GetOrCreateTextChannel(
      context.appConfig.logging.deployLogChannelName,
      context.appConfig.logging.commandLogCategoryName
    );

    if (!channel) {
      continue;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "🚀 Production Deployment Updated",
    })
      .addFields(
        { name: "Commit", value: `\`${info.hash}\`` },
        { name: "Push", value: `[View on GitHub](${commitUrl})` },
        { name: "Message", value: formatMessage(info.message) || "No message" },
        {
          name: "Deployed At",
          value: `<t:${Math.floor(new Date(info.timestamp).getTime() / 1000)}:F>`,
        }
      )
      .setTimestamp(new Date(info.timestamp));

    try {
      await channel.send({ embeds: [embed.toJSON()] });
      sentGuilds.push(guild.id);
    } catch (error) {
      context.logger.Error("Failed to send deployment log", {
        error,
        extra: { guildId: guild.id, channelId: channel.id },
      });
    }
  }

  if (sentGuilds.length > 0) {
    ClearDeployInfo(context.logger);
  }
}

export const ReadyEvent = CreateEvent({
  name: Events.ClientReady,
  once: true,
  execute: async (context: EventContext) => {
    await AnnounceDeploy(context);

    try {
      await context.client.user?.setPresence({
        activities: [
          {
            name: "/setup to get started",
            type: ActivityType.Playing,
          },
        ],
        status: "online",
      });
    } catch (error) {
      context.logger.Warn("Failed to set default presence", { error });
    }
  },
});
