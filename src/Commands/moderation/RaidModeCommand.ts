import {
  ChatInputCommandInteraction,
  ChannelType,
  Client,
  Guild,
  OverwriteResolvable,
  OverwriteType,
  TextChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import {
  ErrorMiddleware,
  LoggingMiddleware,
  PermissionMiddleware,
} from "@middleware";
import { Config } from "@middleware/CommandConfig";
import {
  ConvertDurationToMs,
  DurationUnit,
  EmbedFactory,
  FormatDuration,
} from "@utilities";
import { ModerationDatabase, RaidModeChannelState } from "@database";
import { Logger } from "@shared/Logger";

type StoredOverwrite = {
  id: string;
  allow: string;
  deny: string;
  type: OverwriteType;
};

function SerializeOverwrites(
  overwrites: Iterable<OverwriteResolvable>
): string {
  const serialized: StoredOverwrite[] = [];

  const toBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    const bitfield = (value as { bitfield?: unknown })?.bitfield;
    return typeof bitfield === "bigint" ? bitfield : 0n;
  };

  for (const overwrite of overwrites) {
    const data = overwrite as Partial<{
      id: string;
      allow: unknown;
      deny: unknown;
      type: OverwriteType;
    }>;

    if (typeof data.id !== "string") {
      continue;
    }

    serialized.push({
      id: data.id,
      allow: toBigInt(data.allow).toString(),
      deny: toBigInt(data.deny).toString(),
      type: data.type ?? OverwriteType.Role,
    });
  }

  return JSON.stringify(serialized);
}

function DeserializeOverwrites(serialized: string): OverwriteResolvable[] {
  const parsed = JSON.parse(serialized) as StoredOverwrite[];
  return parsed.map((entry) => ({
    id: entry.id,
    allow: BigInt(entry.allow),
    deny: BigInt(entry.deny),
    type: entry.type,
  }));
}

function ValidateDuration(length: number, unit: DurationUnit): number {
  const durationMs = ConvertDurationToMs(length, unit);
  const maxDuration = 24 * 60 * 60 * 1000; // 24 hours cap for raid mode

  if (durationMs <= 0 || durationMs > maxDuration) {
    throw new Error("Duration must be between 1 second and 24 hours.");
  }

  return durationMs;
}

async function ClearRaidModeByGuild(
  guildId: string,
  client: Client,
  logger: Logger
): Promise<boolean> {
  const db = new ModerationDatabase(logger.Child({ phase: "raid-clear" }));
  try {
    const active = db.GetActiveRaidMode(guildId);
    if (!active) {
      return false;
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      db.MarkRaidModeCleared(active.id);
      db.ClearRaidModeChannelStates(active.id);
      return true;
    }

    const states = db.ListRaidModeChannelStates(active.id);
    for (const state of states) {
      const channel = guild.channels.cache.get(state.channel_id) as
        | TextChannel
        | undefined;
      if (!channel || !channel.manageable) {
        continue;
      }

      try {
        const overwrites = DeserializeOverwrites(state.overwrites);
        await channel.permissionOverwrites.set(overwrites);
        await channel.setRateLimitPerUser(
          state.rate_limit_per_user,
          "Raid mode expired"
        );
      } catch (error) {
        logger.Warn("Failed to restore raid channel state (auto-clear)", {
          error,
          guildId: guild.id,
          extra: { channelId: state.channel_id },
        });
      }
    }

    db.MarkRaidModeCleared(active.id);
    db.ClearRaidModeChannelStates(active.id);
    return true;
  } finally {
    db.Close();
  }
}

async function ApplyRaidMode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const length = interaction.options.getInteger("length", true);
  const unit = interaction.options.getString("unit", true) as DurationUnit;
  const durationMs = ValidateDuration(length, unit);
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
      ephemeral: true,
    });
    return;
  }

  const db = new ModerationDatabase(context.logger.Child({ phase: "db" }));
  try {
    const active = db.GetActiveRaidMode(guild.id);
    if (active) {
      const embed = EmbedFactory.CreateWarning({
        title: "Raid Mode Active",
        description: "Raid mode is already active.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
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
        (channel as TextChannel).manageable
    ) as Map<string, TextChannel>;

    for (const channel of channels.values()) {
      try {
        const snapshot = SerializeOverwrites(
          channel.permissionOverwrites.cache.values()
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
      ephemeral: true,
    });

    // Fallback auto-clear timer in case scheduler misses
    const delay = Math.max(1000, expires_at - Date.now());
    setTimeout(() => {
      ClearRaidModeByGuild(guild.id, interaction.client, context.logger).catch(
        (error) =>
          context.logger.Warn("Raid mode auto-clear timer failed", {
            error,
            guildId: guild.id,
          })
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
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

async function RestoreChannelStates(
  guild: Guild | null,
  channels: RaidModeChannelState[],
  context: CommandContext
): Promise<void> {
  if (!guild) {
    return;
  }

  for (const state of channels) {
    const channel = guild.channels.cache.get(state.channel_id) as
      | TextChannel
      | undefined;
    if (!channel || !channel.manageable) {
      continue;
    }

    try {
      const overwrites = DeserializeOverwrites(state.overwrites);
      await channel.permissionOverwrites.set(overwrites);
      await channel.setRateLimitPerUser(
        state.rate_limit_per_user,
        "Raid mode ended"
      );
    } catch (error) {
      context.logger.Warn("Failed to restore channel state", {
        error,
        guildId: guild.id,
        extra: { channelId: state.channel_id },
      });
    }
  }
}

async function DisableRaidMode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const db = new ModerationDatabase(context.logger.Child({ phase: "db" }));
  try {
    const active = db.GetActiveRaidMode(guild.id);
    if (!active) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Active",
        description: "Raid mode is not currently active.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const channelStates = db.ListRaidModeChannelStates(active.id);
    await RestoreChannelStates(guild, channelStates, context);
    db.MarkRaidModeCleared(active.id);
    db.ClearRaidModeChannelStates(active.id);

    const embed = EmbedFactory.CreateSuccess({
      title: "Raid Mode Disabled",
      description: "Restored channel permissions and slowmode.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to disable raid mode", { error });
    const embed = EmbedFactory.CreateError({
      title: "Disable Failed",
      description: "Could not disable raid mode.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

async function ShowRaidModeStatus(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const db = new ModerationDatabase(context.logger.Child({ phase: "db" }));
  try {
    const active = db.GetActiveRaidMode(guild.id);
    if (!active) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Active",
        description: "Raid mode is not active.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const now = Date.now();
    if (active.expires_at && active.expires_at <= now) {
      await ClearRaidModeByGuild(guild.id, interaction.client, context.logger);
      const embed = EmbedFactory.CreateSuccess({
        title: "Raid Mode Cleared",
        description: "Raid mode had expired and was cleared automatically.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.Create({
      title: "🛡️ Raid Mode Status",
      description: "Raid mode is active.",
    });

    const expiresText = active.expires_at
      ? `<t:${Math.floor(active.expires_at / 1000)}:R>`
      : "No expiry";

    embed.addFields(
      { name: "Slowmode", value: `${active.slowmode_seconds}s`, inline: true },
      { name: "Expires", value: expiresText, inline: true },
      { name: "Applied By", value: `<@${active.applied_by}>`, inline: true }
    );

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to show raid mode status", { error });
    const embed = EmbedFactory.CreateError({
      title: "Status Failed",
      description: "Could not fetch raid mode status.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    db.Close();
  }
}

async function ExecuteRaidMode(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  if (sub === "on") {
    await ApplyRaidMode(interaction, context);
    return;
  }

  if (sub === "off") {
    await DisableRaidMode(interaction, context);
    return;
  }

  if (sub === "status") {
    await ShowRaidModeStatus(interaction, context);
    return;
  }
}

export const RaidModeCommand = CreateCommand({
  name: "raidmode",
  description: "Enable or disable raid protection",
  group: "moderation",
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("on")
          .setDescription("Enable raid mode with lockdown + slowmode")
          .addIntegerOption((option) =>
            option
              .setName("length")
              .setDescription("Duration length")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("unit")
              .setDescription("Duration unit")
              .setRequired(true)
              .addChoices(
                { name: "seconds", value: "seconds" },
                { name: "minutes", value: "minutes" },
                { name: "hours", value: "hours" }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName("slowmode")
              .setDescription("Slowmode seconds to apply (default 10)")
          )
      )
      .addSubcommand((sub) =>
        sub.setName("off").setDescription("Disable raid mode and restore state")
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("Show raid mode status")
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.create()
    .permissions("ManageChannels")
    .cooldownSeconds(5)
    .build(),
  execute: ExecuteRaidMode,
});
