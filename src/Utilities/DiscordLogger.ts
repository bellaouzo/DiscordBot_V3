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
      name: "Guild",
      value: interaction.guild?.name || "DM",
      inline: true,
    },
    {
      name: "Channel",
      value: interaction.channel?.toString() || "Unknown",
      inline: true,
    },
  ]);

  const options = interaction.options.data;
  if (options.length > 0) {
    const argumentFields = options.map((option) => {
      let value: string;

      if (option.type === 1) {
        // Subcommand
        value = `Subcommand: ${option.name}`;
        if (option.options && option.options.length > 0) {
          const subOptions = option.options
            .map(
              (subOpt) => `${subOpt.name}: ${FormatOptionValue(subOpt.value)}`
            )
            .join(", ");
          value += ` (${subOptions})`;
        }
      } else {
        value = FormatOptionValue(option.value);
      }

      return {
        name: option.name,
        value: value.length > 1024 ? value.substring(0, 1021) + "..." : value,
        inline: false,
      };
    });

    embed.addFields([
      {
        name: "Arguments",
        value: "No arguments provided",
        inline: false,
      },
      ...argumentFields,
    ]);
  } else {
    embed.addFields([
      {
        name: "Arguments",
        value: "No arguments provided",
        inline: false,
      },
    ]);
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
