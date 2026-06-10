import { Events, Message, TextChannel } from "discord.js";
import { CreateEvent, EventContext } from "@events/EventFactory";
import { EmbedFactory, IsModerator, ResolveMessageMember } from "@utilities";

async function ExecuteMessageCreateEvent(
  context: EventContext,
  msg: Message,
): Promise<void> {
  if (!msg.guild || !msg.channel.isTextBased() || msg.author.bot) {
    return;
  }

  try {
    const settings = context.databases.serverDb.GetGuildSettings(msg.guild.id);
    const member = await ResolveMessageMember(msg);
    const isStaff = IsModerator(member, settings);

    if (!isStaff) {
      const filters = context.databases.moderationDb.ListLinkFilters(
        msg.guild.id,
      );
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

      if (isBlocked) {
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
          context.logger.Warn("Failed to DM user about blocked link", {
            error,
          });
        }

        if (!notified && settings?.delete_log_channel_id) {
          try {
            const logChannel = await msg.guild.channels.fetch(
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

        return;
      }
    }

    const ticket = context.databases.ticketDb.GetTicketByChannel(
      msg.channel.id,
    );
    if (!ticket) {
      return;
    }

    const messageContent = msg.content || "[Embed or Attachment]";
    context.databases.ticketDb.AddMessage(
      ticket.id,
      msg.author.id,
      messageContent,
    );
  } catch (error) {
    context.logger.Error("Failed to process message", { error });
  }
}

export const MessageCreateEvent = CreateEvent({
  name: Events.MessageCreate,
  once: false,
  execute: ExecuteMessageCreateEvent,
});
