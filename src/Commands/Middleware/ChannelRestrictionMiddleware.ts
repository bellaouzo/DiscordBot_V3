import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "./index";
import { IsProtectedCommand } from "./ProtectedCommands";
import { EmbedFactory } from "@utilities";
import { IsAdmin } from "@utilities/StaffPermissions";
import { ResolveInteractionMember } from "@utilities/GuildMemberResolver";

/**
 * Enforces per-guild channel allow-lists set with `/command restrict`. Commands with no
 * restriction run anywhere; threads count as their parent channel; admins are exempt.
 */
export const ChannelRestrictionMiddleware: CommandMiddleware = {
  name: "channel-restriction",
  execute: async (context, next) => {
    const guild = context.interaction.guild;
    const commandName = context.invocation.commandName;

    if (!guild || IsProtectedCommand(commandName)) {
      await next();
      return;
    }

    const allowed = context.databases.serverDb.ListCommandChannels(
      guild.id,
      commandName,
    );

    if (allowed.length === 0) {
      await next();
      return;
    }

    const channel = context.interaction.channel;
    const channelIds = [
      context.interaction.channelId,
      channel?.isThread() ? channel.parentId : null,
    ];

    if (channelIds.some((id) => id && allowed.includes(id))) {
      await next();
      return;
    }

    const member = await ResolveInteractionMember(context.interaction);
    const settings = context.databases.serverDb.GetGuildSettings(guild.id);
    if (IsAdmin(member, settings)) {
      await next();
      return;
    }

    const embed = EmbedFactory.CreateWarning({
      title: "Wrong Channel",
      description: `\`/${commandName}\` can only be used in ${allowed
        .map((id) => `<#${id}>`)
        .join(", ")}.`,
    });

    await context.responders.interactionResponder.Reply(context.interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
