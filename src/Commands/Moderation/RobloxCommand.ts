import type { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { EnsureRobloxBridgeSettings, ExtractErrorMessage } from "@systems/Roblox/bridge";
import { ExecuteKickSubcommand } from "@systems/Roblox/handlers/KickHandler";
import { ExecuteGroupAuditSubcommand } from "@systems/Roblox/handlers/GroupAuditHandler";
import { ExecuteGroupInfoSubcommand } from "@systems/Roblox/handlers/GroupInfoHandler";
import { ExecuteConnectSubcommand } from "@systems/Roblox/handlers/ConnectHandler";
import { ExecuteStatusSubcommand } from "@systems/Roblox/handlers/StatusHandler";
import { ExecuteDisconnectSubcommand } from "@systems/Roblox/handlers/DisconnectHandler";

async function ExecuteRoblox(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  let settings: ReturnType<typeof EnsureRobloxBridgeSettings>;
  try {
    settings = EnsureRobloxBridgeSettings();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Roblox bridge configuration is invalid.";
    const embed = EmbedFactory.CreateError({
      title: "Roblox Bridge Not Configured",
      description: message,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    if (subcommand === "kick") {
      await ExecuteKickSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "group-audit") {
      await ExecuteGroupAuditSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "group-info") {
      await ExecuteGroupInfoSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "connect") {
      await ExecuteConnectSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "status") {
      await ExecuteStatusSubcommand(interaction, context, settings);
      return;
    }

    if (subcommand === "disconnect") {
      await ExecuteDisconnectSubcommand(interaction, context, settings);
    }
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error;
    context.logger.Error("Roblox command failed", {
      error: errorDetails,
      extra: { subcommand, userId: interaction.user.id },
    });

    const errorMessage =
      ExtractErrorMessage(error) ??
      "Unable to complete this Roblox action right now. Please try again later.";
    const embed = EmbedFactory.CreateError({
      title: "Roblox Command Failed",
      description: errorMessage,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

export const RobloxCommand = CreateCommand({
  name: "roblox",
  description: "Roblox bridge actions",
  group: "moderation",
  config: Config.admin(),
  execute: ExecuteRoblox,
  configure: (builder) => {
    builder
      .addSubcommand((subcommand) =>
        subcommand
          .setName("kick")
          .setDescription("Kick a Roblox player remotely")
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Roblox player name")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for kicking the player")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("group-audit")
          .setDescription("Look up a player's group membership (group key required)")
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Roblox player name to look up")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("group-info")
          .setDescription("View the linked Roblox group's info (group key required)"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("connect")
          .setDescription("Set up a Roblox Open Cloud API key for this server"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("status")
          .setDescription("View Roblox API key connection status"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("disconnect")
          .setDescription("Remove the Roblox API key for this server"),
      );
  },
});
