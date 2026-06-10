import {
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands";
import {
  ConvertDurationToMs,
  DurationUnit,
  EmbedFactory,
  FormatDuration,
} from "@utilities";
import { SerializeOverwrites } from "@commands/Moderation/shared/OverwriteSerialization";
import { ClearRaidModeByGuild } from "@commands/Moderation/RaidMode/ClearRaidMode";

function validateDuration(length: number, unit: DurationUnit): number {
  const durationMs = ConvertDurationToMs(length, unit);
  const maxDuration = 24 * 60 * 60 * 1000;

  if (durationMs <= 0 || durationMs > maxDuration) {
    throw new Error("Duration must be between 1 second and 24 hours.");
  }

  return durationMs;
}

export async function HandleActivateRaidMode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const length = interaction.options.getInteger("length", true);
  const unit = interaction.options.getString("unit", true) as DurationUnit;
  const durationMs = validateDuration(length, unit);
  const durationSeconds = Math.floor(durationMs / 1000);
  const requestedSlowmode = interaction.options.getInteger("slowmode");
  const slowmodeSeconds = requestedSlowmode ?? Math.min(durationSeconds, 21600);

  if (slowmodeSeconds < 0 || slowmodeSeconds > 21600) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Slowmode",
      description: "Slowmode must be between 0 and 21600 seconds.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const db = context.databases.moderationDb;
  try {
    const active = db.GetActiveRaidMode(guild.id);
    if (active) {
      const embed = EmbedFactory.CreateWarning({
        title: "Raid Mode Active",
        description: "Raid mode is already active.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const expires_at = Date.now() + durationMs;
    const raid = db.AddRaidMode({
      guild_id: guild.id,
      slowmode_seconds: slowmodeSeconds,
      expires_at,
      applied_by: interaction.user.id,
    });

    const channels = guild.channels.cache.filter(
      (channel) =>
        (channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.GuildAnnouncement) &&
        "permissionOverwrites" in channel &&
        (channel as TextChannel).manageable,
    ) as Map<string, TextChannel>;

    for (const channel of channels.values()) {
      try {
        const snapshot = SerializeOverwrites(
          channel.permissionOverwrites.cache.values(),
        );

        db.AddRaidModeChannelState({
          raid_id: raid.id,
          guild_id: guild.id,
          channel_id: channel.id,
          overwrites: snapshot,
          rate_limit_per_user: channel.rateLimitPerUser ?? 0,
        });

        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: false,
          SendMessagesInThreads: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });

        await channel.setRateLimitPerUser(slowmodeSeconds, "Raid mode enabled");
      } catch (error) {
        context.logger.Warn("Failed to apply raid mode to channel", {
          error,
          guildId: guild.id,
          extra: { channelId: channel.id },
        });
      }
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Raid Mode Enabled",
      description: `Applied lockdown + slowmode for ${FormatDuration(length, unit)}.`,
    });
    embed.addFields({
      name: "Slowmode",
      value: `${slowmodeSeconds}s`,
      inline: true,
    });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });

    const delay = Math.max(1000, expires_at - Date.now());
    setTimeout(() => {
      ClearRaidModeByGuild(guild.id, interaction.client, context.logger).catch(
        (error) =>
          context.logger.Warn("Raid mode auto-clear timer failed", {
            error,
            guildId: guild.id,
          }),
      );
    }, delay);
  } catch (error) {
    context.logger.Error("Failed to enable raid mode", { error });
    const embed = EmbedFactory.CreateError({
      title: "Enable Failed",
      description: "Could not enable raid mode.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}
