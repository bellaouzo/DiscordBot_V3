import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import type { RobloxBridgeSettings, KickExecutionOutcome } from "@systems/Roblox/types";
import {
  FindPlayerPresence,
  PostKickCommand,
  PollKickResult,
} from "@systems/Roblox/bridge";

export async function ExecuteKickSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const playerName = interaction.options.getString("player", true).trim();
  const reason = interaction.options.getString("reason", true).trim();
  const moderator = {
    id: interaction.user.id,
    username: interaction.user.username,
    tag: interaction.user.tag,
    globalName: interaction.user.globalName ?? undefined,
  };

  if (!playerName || !reason) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Input",
      description: "Player name and reason are required.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  let outcome: KickExecutionOutcome = {
    kind: "failure",
    code: "UNKNOWN",
    message: "No result was returned.",
  };

  try {
    await interactionResponder.WithAction({
      interaction,
      message: {
        embeds: [
          EmbedFactory.Create({
            title: "Processing Roblox Kick",
            description: `Checking active server for **${playerName}**...`,
          }).toJSON(),
        ],
      },
      followUp: () => {
        if (outcome.kind === "not_found") {
          return {
            embeds: [
              EmbedFactory.CreateError({
                title: "Player Not In Server",
                description:
                  "Player is not currently in an active tracked server.",
              }).toJSON(),
            ],
          };
        }

        if (outcome.kind === "success") {
          const embed = EmbedFactory.CreateSuccess({
            title: "Roblox Kick Succeeded",
            description:
              outcome.message?.trim() ||
              `Kick completed for **${playerName}**.`,
          });
          embed.addFields([{ name: "Reason", value: reason, inline: false }]);

          const resultSummary = [outcome.code, outcome.message]
            .filter(Boolean)
            .join(" - ")
            .trim();
          embed.addFields([
            {
              name: "Result",
              value:
                resultSummary ||
                "ACKNOWLEDGED - Command accepted by Roblox bridge.",
              inline: false,
            },
          ]);

          if (outcome.commandId) {
            embed.addFields([
              { name: "Command ID", value: outcome.commandId, inline: false },
            ]);
          }
          return { embeds: [embed.toJSON()] };
        }

        const embed = EmbedFactory.CreateError({
          title:
            outcome.kind === "timeout"
              ? "Roblox Kick Timed Out"
              : "Roblox Kick Failed",
          description:
            outcome.message ??
            "Unable to complete the kick command through the Roblox bridge.",
        });
        if (outcome.code) {
          embed.addFields([
            { name: "Code", value: outcome.code, inline: true },
          ]);
        }
        if (outcome.commandId) {
          embed.addFields([
            { name: "Command ID", value: outcome.commandId, inline: true },
          ]);
        }
        return { embeds: [embed.toJSON()] };
      },
      action: async () => {
        const presenceMatch = await FindPlayerPresence(settings, playerName);
        if (!presenceMatch?.serverId) {
          outcome = { kind: "not_found" };
          return;
        }

        const commandId = await PostKickCommand(
          settings,
          playerName,
          reason,
          presenceMatch.serverId,
          moderator,
        );

        outcome = await PollKickResult(settings, commandId);
      },
    });
  } catch (error) {
    context.logger.Error("Roblox kick command failed", {
      error,
      extra: { playerName, outcome },
    });

    const embed = EmbedFactory.CreateError({
      title: "Roblox Kick Failed",
      description:
        "Unable to send the kick command to the Roblox bridge right now. Please try again later.",
    });

    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  }
}
