import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { RequireGuild, EmbedFactory, AppendFeatureGuideHint } from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";
import {
  CHAT_XP_DEFAULT_COOLDOWN_SECONDS,
  CHAT_XP_DEFAULT_DAILY_CAP,
  CHAT_XP_DEFAULT_MIN_MESSAGE_LENGTH,
  CHAT_XP_DEFAULT_PER_MESSAGE,
} from "@systems/Leveling/constants";

function BuildSettingsEmbed(
  guildId: string,
  context: CommandContext,
): ReturnType<typeof EmbedFactory.Create> {
  const settings = context.databases.serverDb.GetGuildXpSettings(guildId);
  const embed = EmbedFactory.Create({
    title: "Chat XP Settings",
    description: settings.enabled
      ? "Chat XP is **enabled** for this server."
      : "Chat XP is **disabled** for this server.",
  });

  embed.addFields(
    {
      name: "XP per message",
      value: `${settings.xp_per_message}`,
      inline: true,
    },
    {
      name: "Cooldown",
      value: `${settings.cooldown_seconds}s`,
      inline: true,
    },
    {
      name: "Min message length",
      value: `${settings.min_message_length}`,
      inline: true,
    },
    { name: "Daily cap", value: `${settings.daily_cap}`, inline: true },
    {
      name: "Level-up channel",
      value: settings.level_up_channel_id
        ? `<#${settings.level_up_channel_id}>`
        : "Not set",
      inline: true,
    },
    {
      name: "Excluded channels",
      value:
        settings.excluded_channel_ids.length > 0
          ? settings.excluded_channel_ids.map((id) => `<#${id}>`).join(", ")
          : "None",
      inline: false,
    },
  );

  AppendFeatureGuideHint(embed, "xpconfig");

  return embed;
}

async function ExecuteEnable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  context.databases.serverDb.UpsertGuildXpSettings({
    guild_id: guild.id,
    enabled: true,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Chat XP Enabled",
    description: "Members will earn XP from messages in this server.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteDisable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  context.databases.serverDb.UpsertGuildXpSettings({
    guild_id: guild.id,
    enabled: false,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Chat XP Disabled",
    description: "Members will no longer earn XP from messages.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteSet(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const xp = interaction.options.getInteger("xp");
  const cooldown = interaction.options.getInteger("cooldown");
  const minLength = interaction.options.getInteger("min-length");
  const dailyCap = interaction.options.getInteger("daily-cap");
  const levelUpChannel = interaction.options.getChannel("level-up-channel");

  if (
    xp === null &&
    cooldown === null &&
    minLength === null &&
    dailyCap === null &&
    levelUpChannel === undefined
  ) {
    const embed = EmbedFactory.CreateWarning({
      title: "Nothing To Update",
      description: "Provide at least one setting to change.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (levelUpChannel && levelUpChannel.type !== ChannelType.GuildText) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Level-up channel must be a text channel.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildXpSettings({
    guild_id: guild.id,
    xp_per_message: xp ?? undefined,
    cooldown_seconds: cooldown ?? undefined,
    min_message_length: minLength ?? undefined,
    daily_cap: dailyCap ?? undefined,
    level_up_channel_id:
      levelUpChannel === undefined
        ? undefined
        : levelUpChannel
          ? levelUpChannel.id
          : null,
  });

  const embed = BuildSettingsEmbed(guild.id, context);
  embed.setTitle("Chat XP Settings Updated");
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteExcludeAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.options.getChannel("channel", true);

  if (channel.type !== ChannelType.GuildText) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Only text channels can be excluded.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildXpSettings(guild.id);
  if (settings.excluded_channel_ids.includes(channel.id)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Excluded",
      description: `<#${channel.id}> is already excluded.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildXpSettings({
    guild_id: guild.id,
    excluded_channel_ids: [...settings.excluded_channel_ids, channel.id],
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Channel Excluded",
    description: `<#${channel.id}> will not award chat XP.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteExcludeRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.options.getChannel("channel", true);
  const settings = context.databases.serverDb.GetGuildXpSettings(guild.id);
  const next = settings.excluded_channel_ids.filter((id) => id !== channel.id);

  if (next.length === settings.excluded_channel_ids.length) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Excluded",
      description: `<#${channel.id}> is not in the exclusion list.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildXpSettings({
    guild_id: guild.id,
    excluded_channel_ids: next,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Channel Included",
    description: `<#${channel.id}> can award chat XP again.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteExcludeList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildXpSettings(guild.id);
  const embed = EmbedFactory.Create({
    title: "Excluded Channels",
    description:
      settings.excluded_channel_ids.length > 0
        ? settings.excluded_channel_ids.map((id) => `<#${id}>`).join("\n")
        : "No channels are excluded.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteView(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const embed = BuildSettingsEmbed(guild.id, context);
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const XpConfigCommand = CreateCommand({
  name: "xpconfig",
  description: "Configure chat XP settings",
  group: "utility",
  config: Config.mod(3).build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub.setName("enable").setDescription("Enable chat XP for this server"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("disable")
          .setDescription("Disable chat XP for this server"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Update chat XP settings")
          .addIntegerOption((option) =>
            option
              .setName("xp")
              .setDescription(
                `XP per message (default ${CHAT_XP_DEFAULT_PER_MESSAGE})`,
              )
              .setMinValue(1)
              .setMaxValue(100),
          )
          .addIntegerOption((option) =>
            option
              .setName("cooldown")
              .setDescription(
                `Cooldown in seconds (default ${CHAT_XP_DEFAULT_COOLDOWN_SECONDS})`,
              )
              .setMinValue(5)
              .setMaxValue(600),
          )
          .addIntegerOption((option) =>
            option
              .setName("min-length")
              .setDescription(
                `Minimum message length (default ${CHAT_XP_DEFAULT_MIN_MESSAGE_LENGTH})`,
              )
              .setMinValue(1)
              .setMaxValue(500),
          )
          .addIntegerOption((option) =>
            option
              .setName("daily-cap")
              .setDescription(
                `Daily XP cap per user (default ${CHAT_XP_DEFAULT_DAILY_CAP})`,
              )
              .setMinValue(10)
              .setMaxValue(5000),
          )
          .addChannelOption((option) =>
            option
              .setName("level-up-channel")
              .setDescription("Channel for level-up announcements"),
          ),
      )
      .addSubcommandGroup((group) =>
        group
          .setName("exclude-channel")
          .setDescription("Manage channels excluded from chat XP")
          .addSubcommand((sub) =>
            sub
              .setName("add")
              .setDescription("Exclude a channel from chat XP")
              .addChannelOption((option) =>
                option
                  .setName("channel")
                  .setDescription("Channel to exclude")
                  .setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName("remove")
              .setDescription("Remove a channel from the exclusion list")
              .addChannelOption((option) =>
                option
                  .setName("channel")
                  .setDescription("Channel to include again")
                  .setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub.setName("list").setDescription("List excluded channels"),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("view").setDescription("View current chat XP settings"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what chat XP is and how to configure it"),
      );
  },
  execute: async (interaction, context) => {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(true);

    if (sub === "enable") {
      await ExecuteEnable(interaction, context);
      return;
    }
    if (sub === "disable") {
      await ExecuteDisable(interaction, context);
      return;
    }
    if (sub === "set") {
      await ExecuteSet(interaction, context);
      return;
    }
    if (sub === "view") {
      await ExecuteView(interaction, context);
      return;
    }
    if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "xpconfig");
      return;
    }
    if (group === "exclude-channel") {
      if (sub === "add") {
        await ExecuteExcludeAdd(interaction, context);
      } else if (sub === "remove") {
        await ExecuteExcludeRemove(interaction, context);
      } else if (sub === "list") {
        await ExecuteExcludeList(interaction, context);
      }
    }
  },
});
