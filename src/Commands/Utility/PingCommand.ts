import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";

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

async function ExecutePing(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const startedAt = Date.now();
  const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));

  const initialEmbed = EmbedFactory.Create({
    title: "🏓 Pong!",
    description: "Checking bot latency...",
    color: 0x57f287,
    footer: "Discord Bot V3",
  });

  await interactionResponder.Reply(interaction, {
    flags: MessageFlags.Ephemeral,
    embeds: [initialEmbed],
  });

  const responseLatency = Date.now() - startedAt;
  const status = ResolveLatencyStatus(apiLatency);

  const responseEmbed = EmbedFactory.Create({
    title: "🏓 Pong!",
    description: "Here's the current latency information:",
    color: status.color,
    footer: "Discord Bot V3",
  });

  responseEmbed.addFields(
    {
      name: "📡 API Latency",
      value: `${apiLatency}ms`,
      inline: true,
    },
    {
      name: "⚡ Response Time",
      value: `${responseLatency}ms`,
      inline: true,
    },
    {
      name: "✅ Status",
      value: status.label,
      inline: true,
    },
  );

  await interactionResponder.Edit(interaction, { embeds: [responseEmbed] });
}

export const PingCommand = CreateCommand({
  name: "ping",
  description: "Replies with Pong!",
  group: "utility",
  config: Config.utility(1),
  execute: ExecutePing,
});
