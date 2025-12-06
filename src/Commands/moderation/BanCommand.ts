import { ChatInputCommandInteraction, User } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { Config } from "@middleware/CommandConfig";
import { CreateGuildResourceLocator, EmbedFactory } from "@utilities";
import { ConvertDurationToMs, DurationUnit, FormatDuration } from "@utilities";
import { ModerationDatabase } from "@database";

async function ExecuteBan(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  const targetUser = interaction.options.getUser("user");
  const targetUserId =
    targetUser?.id ?? interaction.options.getString("user_id");
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;
  const length = interaction.options.getInteger("length");
  const unit = interaction.options.getString("unit") as DurationUnit | null;

  if ((length && !unit) || (unit && !length)) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Duration",
      description: "Both length and unit are required for timed bans.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  let durationMs = 0;
  if (length && unit) {
    durationMs = ConvertDurationToMs(length, unit);
    const maxDuration = 30 * 24 * 60 * 60 * 1000;
    if (durationMs <= 0 || durationMs > maxDuration) {
      const embed = EmbedFactory.CreateError({
        title: "Invalid Duration",
        description: "Duration must be between 1 second and 30 days.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }
  }

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (!targetUserId) {
    const embed = EmbedFactory.CreateError({
      title: "Missing User",
      description: "You must provide a user or a user ID to ban.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
    logger,
  });

  const targetMember = targetUser
    ? await locator.GetMember(targetUser.id)
    : null;

  if (targetMember && !targetMember.bannable) {
    const embed = EmbedFactory.CreateError({
      title: "Cannot Ban User",
      description:
        "I cannot ban this user. They may have higher permissions than me.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const displayName = targetUser?.tag ?? targetUserId;

  await interactionResponder.WithAction({
    interaction,
    message: {
      embeds: [
        EmbedFactory.Create({
          title: "Processing Ban",
          description: `Banning **${displayName}**...`,
        }).toJSON(),
      ],
    },
    followUp: () => {
      const embed = EmbedFactory.CreateSuccess({
        title: "User Banned",
        description: `Successfully banned **${displayName}**`,
      });

      if (reason !== "No reason provided") {
        embed.addFields([{ name: "Reason", value: reason, inline: false }]);
      }

      if (durationMs > 0 && length && unit) {
        embed.addFields([
          {
            name: "Duration",
            value: FormatDuration(length, unit),
            inline: true,
          },
          {
            name: "Expires",
            value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`,
            inline: true,
          },
        ]);
      }

      return { embeds: [embed.toJSON()] };
    },
    action: async () => {
      await interaction.guild?.bans.create(targetUserId, { reason });

      if (notify) {
        let userToNotify: User | null = targetUser ?? null;
        if (!userToNotify) {
          try {
            userToNotify = await interaction.client.users.fetch(targetUserId);
          } catch {
            userToNotify = null;
          }
        }

        if (userToNotify) {
          await interactionResponder.SendDm(
            userToNotify,
            `You have been banned from ${
              interaction.guild?.name ?? "this server"
            } for: ${reason}`
          );
        }
      }

      if (durationMs > 0 && interaction.guild) {
        const db = new ModerationDatabase(logger.Child({ phase: "db" }));
        try {
          db.AddTempAction({
            action: "ban",
            guild_id: interaction.guild.id,
            user_id: targetUserId,
            moderator_id: interaction.user.id,
            reason,
            expires_at: Date.now() + durationMs,
          });
        } finally {
          db.Close();
        }
      }
    },
  });
}

export const BanCommand = CreateCommand({
  name: "ban",
  description: "Ban a user from the server",
  group: "moderation",
  configure: (builder) => {
    builder
      // Required options must be defined before optional ones
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for banning")
          .setRequired(true)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to ban (if in server)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("user_id")
          .setDescription("Ban by user ID (not in server)")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option.setName("notify").setDescription("Send DM notification to user")
      )
      .addIntegerOption((option) =>
        option
          .setName("length")
          .setDescription("Duration length for temporary ban")
          .setRequired(false)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName("unit")
          .setDescription("Duration unit")
          .setRequired(false)
          .addChoices(
            { name: "Seconds", value: "seconds" },
            { name: "Minutes", value: "minutes" },
            { name: "Hours", value: "hours" },
            { name: "Days", value: "days" }
          )
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.moderation(5),
  execute: ExecuteBan,
});
