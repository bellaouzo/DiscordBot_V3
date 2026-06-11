import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { FormatUptime } from "@utilities/FormatUptime";
import { ListMissingRequiredFeatureApiKeys } from "@config/ApiConfig";

function ResolveLatencyStatus(latencyMs: number): {
  color: number;
  label: string;
} {
  if (latencyMs < 100) {
    return { color: 0x57f287, label: "Excellent" };
  }

  if (latencyMs < 200) {
    return { color: 0xfee75c, label: "Good" };
  }

  return { color: 0xed4245, label: "Fair" };
}

async function ExecuteHealth(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));
  const status = ResolveLatencyStatus(apiLatency);
  const uptime = interaction.client.uptime;

  const dbChecks = [
    context.databases.serverDb.Ping(),
    context.databases.userDb.Ping(),
    context.databases.moderationDb.Ping(),
    context.databases.ticketDb.Ping(),
  ];
  const dbHealthy = dbChecks.every(Boolean);
  const missingApiKeys = ListMissingRequiredFeatureApiKeys();
  const totalApiFeatures = 4;
  const configuredApiFeatures = totalApiFeatures - missingApiKeys.length;

  const embed = EmbedFactory.Create({
    title: "Bot Health",
    description: "Current operational status for this bot instance.",
    color: dbHealthy && apiLatency < 300 ? status.color : 0xed4245,
    footer: "Discord Bot V3",
  });

  embed.addFields(
    {
      name: "API Latency",
      value: `${apiLatency}ms (${status.label})`,
      inline: true,
    },
    {
      name: "Uptime",
      value: uptime ? FormatUptime(uptime / 1000) : "N/A",
      inline: true,
    },
    {
      name: "Database",
      value: dbHealthy ? "All connected" : "Issue detected",
      inline: true,
    },
    {
      name: "Guild Reach",
      value: `${interaction.client.guilds.cache.size} server(s)`,
      inline: true,
    },
    {
      name: "API Features",
      value: `${configuredApiFeatures}/${totalApiFeatures} configured`,
      inline: true,
    },
    {
      name: "Status",
      value: dbHealthy ? "Operational" : "Degraded",
      inline: true,
    },
  );

  await interactionResponder.Reply(interaction, {
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

export const HealthCommand = CreateCommand({
  name: "health",
  description: "Check bot health and connectivity",
  group: "utility",
  config: Config.utility(5),
  execute: ExecuteHealth,
});
