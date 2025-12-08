import { Events } from "discord.js";
import { CreateEvent, EventContext } from "../EventFactory";
import { LoadAppConfig } from "@config/AppConfig";
import { CreateChannelManager, EmbedFactory } from "@utilities";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";

interface DeployInfo {
  hash: string;
  message: string;
  timestamp: string;
}

const DEPLOY_INFO_PATH = join(process.cwd(), "data", "deploy-info.json");

function ReadDeployInfo(logger: EventContext["logger"]): DeployInfo | null {
  if (!existsSync(DEPLOY_INFO_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(DEPLOY_INFO_PATH, "utf8");
    return JSON.parse(raw) as DeployInfo;
  } catch (error) {
    logger.Warn("Failed to read deploy info file", {
      error,
      extra: { path: DEPLOY_INFO_PATH },
    });
    return null;
  }
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

  const config = LoadAppConfig();
  const sentGuilds: string[] = [];

  for (const guild of context.client.guilds.cache.values()) {
    const channelManager = CreateChannelManager({
      guild,
      logger: context.logger,
    });

    const channel = await channelManager.GetOrCreateTextChannel(
      config.logging.deployLogChannelName,
      config.logging.commandLogCategoryName
    );

    if (!channel) {
      continue;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "🚀 Production Deployment Updated",
      description: `Deployed commit **${info.hash}**\nCommit Message: “${info.message}”`,
    }).setTimestamp(new Date(info.timestamp));

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
  },
});
