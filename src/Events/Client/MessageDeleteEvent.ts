import { Events, Message, PartialMessage, TextChannel } from "discord.js";
import { CreateEvent, EventContext } from "@events/EventFactory";
import { CreateChannelManager } from "@utilities/ChannelManager";
import { EmbedFactory } from "@utilities";
import { LoadAppConfig } from "@config/AppConfig";

async function ExecuteMessageDeleteEvent(
  context: EventContext,
  ...args: unknown[]
): Promise<void> {
  const deleted = args[0] as Message | PartialMessage | undefined;
  if (!deleted) return;

  const msg = deleted.partial ? deleted : (deleted as Message);

  if (!msg.guild || !msg.channel || !msg.channel.isTextBased()) {
    return;
  }

  const config = LoadAppConfig();
  const channelManager = CreateChannelManager({
    guild: msg.guild,
    logger: context.logger,
  });

  const logChannel = await channelManager.GetOrCreateTextChannel(
    config.logging.messageDeleteChannelName,
    config.logging.commandLogCategoryName
  );

  if (!logChannel) {
    return;
  }

  const content =
    !msg.partial && msg.content
      ? msg.content.slice(0, 1900)
      : "Content unavailable (partial or empty).";

  const attachments =
    !msg.partial && msg.attachments.size > 0
      ? msg.attachments.map((att) => att.url).join("\n")
      : undefined;

  const embed = EmbedFactory.Create({
    title: "🗑️ Message Deleted",
    description: `**Channel:** ${msg.channel.toString()}\n**Author:** ${msg.author ? `${msg.author} (${msg.author.id})` : "Unknown"}`,
    timestamp: true,
  });

  embed.addFields({
    name: "Content",
    value: content || "None",
  });

  if (attachments) {
    embed.addFields({
      name: "Attachments",
      value: attachments.length > 0 ? attachments : "None",
    });
  }

  try {
    await (logChannel as TextChannel).send({ embeds: [embed.toJSON()] });
  } catch (error) {
    context.logger.Error("Failed to send deleted message log", {
      error,
      extra: {
        channelId: logChannel.id,
        deletedChannelId: msg.channel.id,
        guildId: msg.guild.id,
      },
    });
  }
}

export const MessageDeleteEvent = CreateEvent({
  name: Events.MessageDelete,
  once: false,
  execute: ExecuteMessageDeleteEvent,
});
