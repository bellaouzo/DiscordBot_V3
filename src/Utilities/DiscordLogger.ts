import { Guild, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Logger } from "@shared/Logger";
import { CommandDefinition } from "@commands";
import { CreateChannelManager, EmbedFactory } from "./";
import { LoggingConfig } from "@config";

export interface DiscordLoggerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly config: LoggingConfig;
}

export interface DiscordLogger {
  LogCommandExecution(
    interaction: ChatInputCommandInteraction,
    command: CommandDefinition
  ): Promise<void>;
}

export function CreateDiscordLogger(
  options: DiscordLoggerOptions
): DiscordLogger {
  const channelManager = CreateChannelManager({
    guild: options.guild,
    logger: options.logger,
  });

  return {
    LogCommandExecution: async (
      interaction: ChatInputCommandInteraction,
      command: CommandDefinition
    ): Promise<void> => {
      try {
        const channel = await channelManager.GetOrCreateTextChannel(
          options.config.commandLogChannelName,
          options.config.commandLogCategoryName
        );

        if (!channel) {
          options.logger.Warn("Failed to get or create logging channel", {
            extra: {
              guildId: options.guild.id,
              channelName: options.config.commandLogChannelName,
              categoryName: options.config.commandLogCategoryName,
            },
          });
          return;
        }

        const embed = CreateCommandLogEmbed(interaction, command);

        await channel.send({ embeds: [embed] });
      } catch (error) {
        options.logger.Error("Failed to log command to Discord", {
          error,
          extra: {
            commandName: command.data.name,
            userId: interaction.user.id,
            guildId: interaction.guildId,
          },
        });
      }
    },
  };
}

function CreateCommandLogEmbed(
  interaction: ChatInputCommandInteraction,
  command: CommandDefinition
): EmbedBuilder {
  const embed = EmbedFactory.Create({
    title: `Command Executed: ${command.data.name}`,
    color: 0x00ff00,
    footer: `Command Group: ${command.group}`,
    timestamp: true,
  });

  embed.addFields([
    {
      name: "User",
      value: `${interaction.user} (${interaction.user.id})`,
      inline: true,
    },
    {
      name: "Channel",
      value: interaction.channel?.toString() || "Unknown",
      inline: true,
    },
  ]);

  const options = interaction.options.data;
  if (options.length === 0) {
    embed.addFields([
      {
        name: "Arguments",
        value: "No arguments provided",
        inline: false,
      },
    ]);
  } else {
    const first = options[0];
    // Subcommand
    if (first.type === 1) {
      const subOptions =
        first.options?.map(
          (subOpt) => `${subOpt.name}: ${FormatOptionValue(subOpt.value)}`
        ) ?? [];

      embed.addFields([
        {
          name: "Subcommand",
          value: first.name,
          inline: false,
        },
        {
          name: "Arguments",
          value:
            subOptions.length > 0
              ? subOptions.join("\n")
              : "No arguments provided",
          inline: false,
        },
      ]);
    } else {
      // Top-level options without subcommand
      const argLines = options.map(
        (opt) => `${opt.name}: ${FormatOptionValue(opt.value)}`
      );

      embed.addFields([
        {
          name: "Arguments",
          value: argLines.join("\n"),
          inline: false,
        },
      ]);
    }
  }

  return embed;
}

function FormatOptionValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
