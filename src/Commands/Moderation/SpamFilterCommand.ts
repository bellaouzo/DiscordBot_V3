import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory, RequireGuild } from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";
import type { SpamFilterSettings } from "@database";
import { SharedSpamDetector } from "@systems/Moderation/SpamDetector";
import { DescribeSpamLadder } from "@systems/Moderation/SpamEscalation";

const HOUR_MS = 60 * 60 * 1000;
const MAX_EXEMPT_CHANNELS = 25;

async function Reply(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  embed: ReturnType<typeof EmbedFactory.Create>,
): Promise<void> {
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

function BuildSettingsEmbed(
  enabled: boolean,
  settings: SpamFilterSettings,
  title = "🚫 Spam Filter",
): ReturnType<typeof EmbedFactory.Create> {
  const embed = EmbedFactory.Create({
    title,
    description: enabled
      ? "✅ **Enabled.** Staff are never filtered."
      : "⏸️ **Disabled.** Turn it on with `/spamfilter enable`.",
  });
  embed.addFields(
    {
      name: "Flood",
      value: `More than **${settings.max_messages}** messages in **${settings.window_seconds}s**`,
      inline: true,
    },
    {
      name: "Duplicates",
      value: `Same message **${settings.duplicate_threshold}** times in 30s`,
      inline: true,
    },
    {
      name: "Mentions",
      value: `**${settings.mention_threshold}**+ mentions in one message`,
      inline: true,
    },
    {
      name: `Escalation (strikes expire after ${settings.strike_decay_hours}h)`,
      value: DescribeSpamLadder(),
      inline: false,
    },
    {
      name: "Exempt channels",
      value:
        settings.exempt_channel_ids.length > 0
          ? settings.exempt_channel_ids.map((id) => `<#${id}>`).join(", ")
          : "None",
      inline: false,
    },
  );
  return embed;
}

async function HandleToggle(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  enabled: boolean,
): Promise<void> {
  const guild = RequireGuild(interaction);
  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    spam_filter_enabled: enabled,
  });
  const settings = context.databases.moderationDb.GetSpamFilterSettings(
    guild.id,
  );
  await Reply(
    interaction,
    context,
    BuildSettingsEmbed(
      enabled,
      settings,
      enabled ? "🚫 Spam Filter Enabled" : "🚫 Spam Filter Disabled",
    ),
  );
}

async function HandleView(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const enabled =
    context.databases.serverDb.GetGuildSettings(guild.id)
      ?.spam_filter_enabled ?? false;
  const settings = context.databases.moderationDb.GetSpamFilterSettings(
    guild.id,
  );
  await Reply(interaction, context, BuildSettingsEmbed(enabled, settings));
}

async function HandleConfig(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const { options } = interaction;
  const update = {
    max_messages: options.getInteger("max-messages") ?? undefined,
    window_seconds: options.getInteger("window-seconds") ?? undefined,
    duplicate_threshold: options.getInteger("duplicates") ?? undefined,
    mention_threshold: options.getInteger("mentions") ?? undefined,
    strike_decay_hours: options.getInteger("strike-decay-hours") ?? undefined,
  };

  if (Object.values(update).every((value) => value === undefined)) {
    await HandleView(interaction, context);
    return;
  }

  const settings = context.databases.moderationDb.UpsertSpamFilterSettings({
    guild_id: guild.id,
    ...update,
  });
  const enabled =
    context.databases.serverDb.GetGuildSettings(guild.id)
      ?.spam_filter_enabled ?? false;
  await Reply(
    interaction,
    context,
    BuildSettingsEmbed(enabled, settings, "🚫 Spam Filter Updated"),
  );
}

async function HandleExemptAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.options.getChannel("channel", true);
  const { moderationDb } = context.databases;
  const settings = moderationDb.GetSpamFilterSettings(guild.id);

  if (settings.exempt_channel_ids.includes(channel.id)) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateWarning({
        title: "Already Exempt",
        description: `<#${channel.id}> is already exempt from the spam filter.`,
      }),
    );
    return;
  }

  if (settings.exempt_channel_ids.length >= MAX_EXEMPT_CHANNELS) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateError({
        title: "Too Many Exemptions",
        description: `You can exempt up to ${MAX_EXEMPT_CHANNELS} channels.`,
      }),
    );
    return;
  }

  moderationDb.UpsertSpamFilterSettings({
    guild_id: guild.id,
    exempt_channel_ids: [...settings.exempt_channel_ids, channel.id],
  });
  await Reply(
    interaction,
    context,
    EmbedFactory.CreateSuccess({
      title: "Channel Exempted",
      description: `Messages in <#${channel.id}> (and its threads) are no longer spam-filtered.`,
    }),
  );
}

async function HandleExemptRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.options.getChannel("channel", true);
  const { moderationDb } = context.databases;
  const settings = moderationDb.GetSpamFilterSettings(guild.id);

  if (!settings.exempt_channel_ids.includes(channel.id)) {
    await Reply(
      interaction,
      context,
      EmbedFactory.CreateWarning({
        title: "Not Exempt",
        description: `<#${channel.id}> is not on the exempt list.`,
      }),
    );
    return;
  }

  moderationDb.UpsertSpamFilterSettings({
    guild_id: guild.id,
    exempt_channel_ids: settings.exempt_channel_ids.filter(
      (id) => id !== channel.id,
    ),
  });
  await Reply(
    interaction,
    context,
    EmbedFactory.CreateSuccess({
      title: "Exemption Removed",
      description: `<#${channel.id}> is spam-filtered again.`,
    }),
  );
}

async function HandleStrikes(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const { moderationDb } = context.databases;
  const settings = moderationDb.GetSpamFilterSettings(guild.id);
  const strikes = moderationDb.ListSpamStrikes(guild.id, user.id, 10);
  const activeSince = Date.now() - settings.strike_decay_hours * HOUR_MS;
  const activeCount = moderationDb.CountSpamStrikesSince({
    guild_id: guild.id,
    user_id: user.id,
    since: activeSince,
  });

  const lines = strikes.map((strike) => {
    const action =
      strike.action === "timeout" && strike.duration_ms
        ? `timeout ${Math.round(strike.duration_ms / 60000)}m`
        : "warning";
    const expired = strike.created_at < activeSince ? " · expired" : "";
    return `<t:${Math.floor(strike.created_at / 1000)}:R> · ${action}${expired}\n> ${strike.reason}`;
  });

  await Reply(
    interaction,
    context,
    EmbedFactory.Create({
      title: `🚫 Spam Strikes: ${user.username}`,
      description:
        strikes.length === 0
          ? "No spam strikes on record."
          : `**${activeCount}** active strike${activeCount === 1 ? "" : "s"} (last ${settings.strike_decay_hours}h)\n\n${lines.join("\n")}`,
    }),
  );
}

async function HandleReset(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const removed = context.databases.moderationDb.ClearSpamStrikes(
    guild.id,
    user.id,
  );
  SharedSpamDetector.Reset(guild.id, user.id);

  await Reply(
    interaction,
    context,
    EmbedFactory.CreateSuccess({
      title: "Strikes Reset",
      description:
        removed > 0
          ? `Cleared ${removed} spam strike${removed === 1 ? "" : "s"} for ${user}. Their next violation starts at a warning.`
          : `${user} had no spam strikes.`,
    }),
  );
}

export const SpamFilterCommand = CreateCommand({
  name: "spamfilter",
  description: "Configure automatic spam removal and escalation",
  group: "moderation",
  config: Config.mod(3).build(),
  subcommands: [
    {
      name: "enable",
      description: "Turn the spam filter on",
      execute: (interaction, context) =>
        HandleToggle(interaction, context, true),
    },
    {
      name: "disable",
      description: "Turn the spam filter off",
      execute: (interaction, context) =>
        HandleToggle(interaction, context, false),
    },
    {
      name: "view",
      description: "Show the current spam filter settings",
      execute: HandleView,
    },
    {
      name: "config",
      description: "Change detection thresholds (omit all to view)",
      options: (sub) =>
        sub
          .addIntegerOption((option) =>
            option
              .setName("max-messages")
              .setDescription(
                "Messages allowed per window before it is a flood",
              )
              .setMinValue(2)
              .setMaxValue(30),
          )
          .addIntegerOption((option) =>
            option
              .setName("window-seconds")
              .setDescription("Length of the flood window in seconds")
              .setMinValue(2)
              .setMaxValue(60),
          )
          .addIntegerOption((option) =>
            option
              .setName("duplicates")
              .setDescription(
                "Identical messages within 30s that count as spam",
              )
              .setMinValue(2)
              .setMaxValue(20),
          )
          .addIntegerOption((option) =>
            option
              .setName("mentions")
              .setDescription("Mentions in one message that count as spam")
              .setMinValue(2)
              .setMaxValue(50),
          )
          .addIntegerOption((option) =>
            option
              .setName("strike-decay-hours")
              .setDescription("Hours before a strike stops counting")
              .setMinValue(1)
              .setMaxValue(720),
          ),
      execute: HandleConfig,
    },
    {
      name: "exempt",
      description: "Manage channels the spam filter ignores",
      subcommands: [
        {
          name: "add",
          description: "Stop filtering a channel",
          options: (sub) =>
            sub.addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel to exempt")
                .setRequired(true)
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement,
                  ChannelType.GuildVoice,
                  ChannelType.GuildForum,
                ),
            ),
          execute: HandleExemptAdd,
        },
        {
          name: "remove",
          description: "Filter a channel again",
          options: (sub) =>
            sub.addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel to stop exempting")
                .setRequired(true),
            ),
          execute: HandleExemptRemove,
        },
      ],
    },
    {
      name: "strikes",
      description: "Show a member's spam strikes",
      options: (sub) =>
        sub.addUserOption((option) =>
          option.setName("user").setDescription("Member").setRequired(true),
        ),
      execute: HandleStrikes,
    },
    {
      name: "reset",
      description: "Clear a member's spam strikes",
      options: (sub) =>
        sub.addUserOption((option) =>
          option.setName("user").setDescription("Member").setRequired(true),
        ),
      execute: HandleReset,
    },
    {
      name: "about",
      description: "Learn how the spam filter works",
      execute: (interaction, context) =>
        ReplyWithFeatureAbout(interaction, context, "spamfilter"),
    },
  ],
});
