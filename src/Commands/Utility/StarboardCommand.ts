import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { RequireGuild, EmbedFactory, AppendFeatureGuideHint } from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecuteSetChannel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.options.getChannel("channel", true);

  if (channel.type !== ChannelType.GuildText) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Starboard channel must be a text channel.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    starboard_channel_id: channel.id,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Starboard Channel Set",
    description: `Highlighted messages will be posted in ${channel}.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteSetEmoji(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const emoji = interaction.options.getString("emoji", true).trim();

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    starboard_emoji: emoji,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Starboard Emoji Set",
    description: `Starboard now uses ${emoji}.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteSetThreshold(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const threshold = interaction.options.getInteger("count", true);

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    starboard_threshold: threshold,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Starboard Threshold Set",
    description: `Messages need **${threshold}** reactions to reach the starboard.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteStatus(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);

  const embed = EmbedFactory.Create({
    title: "Starboard Status",
    description: settings?.starboard_channel_id
      ? `Posting to <#${settings.starboard_channel_id}>`
      : "Starboard is not configured.",
  });

  if (settings) {
    embed.addFields(
      {
        name: "Emoji",
        value: settings.starboard_emoji,
        inline: true,
      },
      {
        name: "Threshold",
        value: `${settings.starboard_threshold}`,
        inline: true,
      },
    );
  }

  AppendFeatureGuideHint(embed, "starboard");

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const StarboardCommand = CreateCommand({
  name: "starboard",
  description: "Configure the server starboard",
  group: "utility",
  config: Config.mod(3).build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("set-channel")
          .setDescription("Set the starboard channel")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Channel for starred messages")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("set-emoji")
          .setDescription("Set the starboard reaction emoji")
          .addStringOption((option) =>
            option
              .setName("emoji")
              .setDescription("Emoji that counts toward starboard")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("set-threshold")
          .setDescription("Set how many reactions are required")
          .addIntegerOption((option) =>
            option
              .setName("count")
              .setDescription("Required reaction count")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(50),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("View starboard configuration"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what the starboard does and how to set it up"),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "set-channel") {
      await ExecuteSetChannel(interaction, context);
    } else if (sub === "set-emoji") {
      await ExecuteSetEmoji(interaction, context);
    } else if (sub === "set-threshold") {
      await ExecuteSetThreshold(interaction, context);
    } else if (sub === "status") {
      await ExecuteStatus(interaction, context);
    } else if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "starboard");
    }
  },
});
