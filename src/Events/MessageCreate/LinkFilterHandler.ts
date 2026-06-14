import type { TextChannel } from "discord.js";
import { EmbedFactory, IsModerator, ResolveMessageMember } from "@utilities";
import type { MessageCreateHandler } from "./types";

export const LinkFilterHandler: MessageCreateHandler = {
  name: "link-filter",

  async execute(context, msg) {
    const guild = msg.guild;
    if (!guild) {
      return "continue";
    }

    const settings = context.databases.serverDb.GetGuildSettings(guild.id);
    const member = await ResolveMessageMember(msg);
    const isStaff = IsModerator(member, settings);

    if (isStaff) {
      return "continue";
    }

    const filters = context.databases.moderationDb.ListLinkFilters(guild.id);
    const allow = filters
      .filter((f) => f.type === "allow")
      .map((f) => f.pattern);
    const block = filters
      .filter((f) => f.type === "block")
      .map((f) => f.pattern);
    const content = (msg.content ?? "").toLowerCase();

    const isAllowed = allow.some((pattern) => content.includes(pattern));
    const isBlocked =
      !isAllowed && block.some((pattern) => content.includes(pattern));

    if (!isBlocked) {
      return "continue";
    }

    try {
      await msg.delete();
    } catch (error) {
      context.logger.Error("Failed to delete blocked message", { error });
    }

    const notice = EmbedFactory.CreateWarning({
      title: "Link Blocked",
      description: "Your message contained a blocked link and was removed.",
    });

    let notified = false;
    try {
      await msg.author.send({ embeds: [notice.toJSON()] });
      notified = true;
    } catch (error) {
      context.logger.Warn("Failed to DM user about blocked link", { error });
    }

    if (!notified && settings?.delete_log_channel_id) {
      try {
        const logChannel = await guild.channels.fetch(
          settings.delete_log_channel_id,
        );
        if (logChannel?.isTextBased()) {
          await (logChannel as TextChannel).send({
            content: `<@${msg.author.id}>`,
            embeds: [notice.toJSON()],
          });
        }
      } catch (error) {
        context.logger.Error(
          "Failed to send link block notice to log channel",
          {
            error,
          },
        );
      }
    }

    return "stop";
  },
};
