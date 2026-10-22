import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { CommandMiddleware } from "./index";
import { CreateErrorMessage } from "@responders/MessageFactory";
import { FormatPermissionName } from "./PermissionMiddleware";

/**
 * Checks that the bot has the permissions a command needs in the channel it was used in, so a
 * missing permission produces a clear message instead of a Discord 50013 error mid-command.
 * Uses interaction.appPermissions, which Discord sends with every interaction (no API call).
 * Read-only subcommands opt out with a per-subcommand `botPermissions: []` override.
 */
export const BotPermissionMiddleware: CommandMiddleware = {
  name: "bot-permissions",
  execute: async (context, next) => {
    const botPermissions = context.config.botPermissions;
    const appPermissions = context.interaction.appPermissions;

    if (
      botPermissions.length === 0 ||
      !context.interaction.guild ||
      !appPermissions
    ) {
      await next();
      return;
    }

    const missing = botPermissions.filter(
      (permission) => !appPermissions.has(PermissionFlagsBits[permission]),
    );

    if (missing.length === 0) {
      await next();
      return;
    }

    const formatted = missing.map(FormatPermissionName);
    const description =
      formatted.length === 1
        ? `I need the **${formatted[0]}** permission in this channel to do that.`
        : `I need these permissions in this channel to do that:\n• ${formatted.join("\n• ")}`;

    context.logger.Info("Command blocked: bot is missing permissions", {
      command: context.invocation.path,
      extra: { missing },
    });

    const message = CreateErrorMessage({
      title: "❌ Missing Bot Permissions",
      description,
      hint: "A server admin can grant these in Server Settings → Roles, or in the channel's permission settings.",
    });
    await context.responders.interactionResponder.Reply(context.interaction, {
      ...message,
      flags: MessageFlags.Ephemeral,
    });
  },
};
