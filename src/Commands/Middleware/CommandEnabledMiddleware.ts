import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "@middleware";
import { IsProtectedCommand } from "@middleware/ProtectedCommands";
import { EmbedFactory } from "@utilities";

export const CommandEnabledMiddleware: CommandMiddleware = {
  name: "command-enabled",
  execute: async (context, next) => {
    const guild = context.interaction.guild;
    if (!guild) {
      await next();
      return;
    }

    const commandName = context.command.data.name;
    if (IsProtectedCommand(commandName)) {
      await next();
      return;
    }

    const isDisabled = context.databases.serverDb.IsCommandDisabled(
      guild.id,
      commandName,
    );

    if (!isDisabled) {
      await next();
      return;
    }

    const embed = EmbedFactory.CreateWarning({
      title: "Command Disabled",
      description: "This command is disabled in this server.",
    });

    await context.responders.interactionResponder.Reply(context.interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
