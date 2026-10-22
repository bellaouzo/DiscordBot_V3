import type { TextChannel } from "discord.js";
import {
  ParseTagTrigger,
  RenderTagContent,
  TagAllowedMentions,
} from "@systems/Tags/TagContent";
import type { MessageCreateHandler } from "./types";

export const TagTriggerHandler: MessageCreateHandler = {
  name: "tag-trigger",

  async execute(context, msg) {
    const guild = msg.guild;
    const content = msg.content ?? "";
    if (!guild || content.length === 0) {
      return "continue";
    }

    const { serverDb } = context.databases;
    const prefix = serverDb.GetGuildSettings(guild.id)?.tag_prefix ?? "!";
    const name = ParseTagTrigger(content, prefix);
    if (!name) {
      return "continue";
    }

    const tag = serverDb.GetCustomTag(guild.id, name);
    if (!tag) {
      return "continue";
    }

    try {
      await (msg.channel as TextChannel).send({
        content: RenderTagContent(tag.content, {
          userId: msg.author.id,
          guildName: guild.name,
          channelId: msg.channelId,
          memberCount: guild.memberCount,
        }),
        allowedMentions: TagAllowedMentions(msg.author.id),
      });
      serverDb.IncrementCustomTagUses(guild.id, tag.name);
    } catch (error) {
      context.logger.Warn("Failed to send tag response", {
        error,
        extra: { guildId: guild.id, channelId: msg.channelId, tag: tag.name },
      });
    }

    return "continue";
  },
};
