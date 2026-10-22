import type {
  Guild,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  TextChannel,
} from "discord.js";
import type { Logger } from "@shared/Logger";
import { CreateChannelManager, EmbedFactory } from "./";
import type { LoggingConfig } from "@config/AppConfig";

/** What a command log entry describes: the full command path and its group. */
export interface LoggedCommand {
  readonly path: string;
  readonly group: string;
}

type LoggedInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction;

export interface DiscordLoggerOptions {
  readonly guild: Guild;
  readonly logger: Logger;
  readonly config: LoggingConfig;
  readonly commandLogChannelId?: string | null;
}

export interface DiscordLogger {
  LogCommandExecution(
    interaction: LoggedInteraction,
    command: LoggedCommand,
  ): Promise<void>;
}

export function CreateDiscordLogger(
  options: DiscordLoggerOptions,
): DiscordLogger {
  const channelManager = CreateChannelManager({
    guild: options.guild,
    logger: options.logger,
  });

  return {
    LogCommandExecution: async (
      interaction: LoggedInteraction,
      command: LoggedCommand,
    ): Promise<void> => {
      if (interaction.guildId && interaction.guildId !== options.guild.id) {
        options.logger.Warn("Skipping command log for mismatched guild", {
          extra: {
            interactionGuildId: interaction.guildId,
            loggerGuildId: options.guild.id,
            commandName: command.path,
          },
        });
        return;
      }

      try {
        const channel = await ResolveCommandLogChannel(options, channelManager);

        if (!channel) {
          options.logger.Warn("Failed to get or create logging channel", {
            extra: {
              guildId: options.guild.id,
              channelName: options.config.commandLogChannelName,
              categoryName: options.config.commandLogCategoryName,
              commandLogChannelId: options.commandLogChannelId ?? null,
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
            commandName: command.path,
            userId: interaction.user.id,
            guildId: interaction.guildId,
          },
        });
      }
    },
  };
}

async function ResolveCommandLogChannel(
  options: DiscordLoggerOptions,
  channelManager: ReturnType<typeof CreateChannelManager>,
): Promise<TextChannel | null> {
  if (options.commandLogChannelId) {
    try {
      const configured = await options.guild.channels.fetch(
        options.commandLogChannelId,
      );
      if (configured?.isTextBased()) {
        return configured as TextChannel;
      }
    } catch (error) {
      options.logger.Warn("Configured command log channel unavailable", {
        error,
        extra: {
          guildId: options.guild.id,
          commandLogChannelId: options.commandLogChannelId,
        },
      });
    }
  }

  return channelManager.GetOrCreateTextChannel(
    options.config.commandLogChannelName,
    options.config.commandLogCategoryName,
  );
}

function CreateCommandLogEmbed(
  interaction: LoggedInteraction,
  command: LoggedCommand,
): EmbedBuilder {
  const embed = EmbedFactory.Create({
    title: `Command Executed: ${command.path}`,
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
    if (first.type === 1) {
      const subOptions =
        first.options?.map(
          (subOpt) => `${subOpt.name}: ${FormatOptionValue(subOpt.value)}`,
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
      const argLines = options.map(
        (opt) => `${opt.name}: ${FormatOptionValue(opt.value)}`,
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
