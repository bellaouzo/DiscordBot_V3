import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
import { CooldownMiddleware } from "../Middleware/CooldownMiddleware";
import { ErrorMiddleware } from "../Middleware/ErrorMiddleware";
import { Config } from "../Middleware/CommandConfig";
import { EmbedFactory } from "../../Utilities";
import { AllCommands } from "../registry";
import * as path from "path";
import * as fs from "fs";

function FormatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function FormatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function GetDiscordJsVersion(): string {
  try {
    const discordJsPath = require.resolve("discord.js");
    const packageDir = path.dirname(discordJsPath);

    let packagePath = path.join(packageDir, "package.json");

    if (!fs.existsSync(packagePath)) {
      packagePath = path.join(packageDir, "..", "package.json");
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return packageJson.version || "Unknown";
  } catch {
    return "Unknown";
  }
}

async function ExecuteDebug(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const uptime = interaction.client.uptime;
  const memory = process.memoryUsage();
  const discordVersion = GetDiscordJsVersion();
  const nodeVersion = process.version;
  const commandCount = AllCommands().length;

  const embed = EmbedFactory.Create({
    title: "Bot Debug Information",
    footer: "Discord Bot V3",
  });

  embed.addFields(
    {
      name: "⏱️ Uptime",
      value: uptime ? FormatUptime(uptime / 1000) : "N/A",
      inline: true,
    },
    {
      name: "💾 Memory Usage",
      value: FormatBytes(memory.heapUsed),
      inline: true,
    },
    {
      name: "📦 Discord.js Version",
      value: `v${discordVersion}`,
      inline: true,
    },
    {
      name: "🌐 Node.js Version",
      value: nodeVersion,
      inline: true,
    },
    {
      name: "👤 Developer",
      value: "<@183702016969670657> (@bellaouzo)",
      inline: true,
    },
    {
      name: "🔧 Commands",
      value: `${commandCount} registered`,
      inline: true,
    }
  );

  await interactionResponder.Reply(interaction, { embeds: [embed] });
}

export const DebugCommand = CreateCommand({
  name: "debug",
  description: "Display bot diagnostic and debug information",
  group: "utility",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(5),
  execute: ExecuteDebug,
});
