import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import {
  LoggingMiddleware,
  PermissionMiddleware,
  ErrorMiddleware,
  CooldownMiddleware,
} from "../Middleware";
import { Config } from "../Middleware/CommandConfig";
import { EmbedFactory, CreateGuildResourceLocator } from "../../Utilities";

function ConvertDurationToMs(length: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case "seconds":
      return length * 1000;
    case "minutes":
      return length * 60 * 1000;
    case "hours":
      return length * 60 * 60 * 1000;
    case "days":
      return length * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

function FormatDuration(length: number, unit: string): string {
  const unitName = unit.toLowerCase();
  const isPlural = length !== 1;
  const unitMap: Record<string, string> = {
    days: isPlural ? "days" : "day",
    hours: isPlural ? "hours" : "hour",
    minutes: isPlural ? "minutes" : "minute",
    seconds: isPlural ? "seconds" : "second",
  };

  return `${length} ${unitMap[unitName] ?? unitMap.seconds}`;
}

function ValidateTargetMember(
  targetMember: GuildMember | null | undefined,
  interaction: ChatInputCommandInteraction,
): asserts targetMember is GuildMember {
  if (!targetMember?.moderatable) {
    throw new Error(
      "I cannot timeout this user. They may be the server owner or have higher permissions than me.",
    );
  }

  if (targetMember.id === interaction.user.id) {
    throw new Error("You cannot timeout yourself.");
  }

  if (targetMember.id === interaction.client.user.id) {
    throw new Error("I cannot timeout myself.");
  }
}

async function ExecuteMute(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  const targetUser = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
    logger,
  });

  if (subcommand === "set") {
    const length = interaction.options.getInteger("length", true);
    const unit = interaction.options.getString("unit", true);

    const durationMs = ConvertDurationToMs(length, unit);
    const maxDuration = 28 * 24 * 60 * 60 * 1000;

    if (durationMs <= 0 || durationMs > maxDuration) {
      const errorEmbed = EmbedFactory.CreateError({
        title: "Invalid Duration",
        description: "Duration must be between 1 second and 28 days.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [errorEmbed],
        ephemeral: true,
      });
      return;
    }

    let dmFailed = false;

    await interactionResponder.WithAction({
      interaction,
      message: {
        embeds: [
          EmbedFactory.Create({
            title: "⏳ Processing Mute",
            description: `Applying timeout to ${targetUser.username}...`,
            color: 0x5865f2,
          }),
        ],
      },
      followUp: () => {
        const embed = EmbedFactory.CreateSuccess({
          title: "User Muted",
          description: `Successfully muted **${
            targetUser.username
          }** for ${FormatDuration(length, unit)}`,
        });

        if (reason !== "No reason provided") {
          embed.addFields([{ name: "Reason", value: reason, inline: false }]);
        }

        if (dmFailed) {
          embed.setFooter({
            text: "⚠️ Could not send DM notification to user",
          });
        }

        return {
          embeds: [embed],
        };
      },
      action: async () => {
        const targetMember = await locator.GetMember(targetUser.id);
        if (!targetMember) {
          throw new Error("User is not a member of this server.");
        }
        ValidateTargetMember(targetMember, interaction);

        await targetMember.timeout(durationMs, reason);

        if (notify) {
          interactionResponder
            .SendDm(
              targetUser,
              `You have been muted in ${
                interaction.guild?.name ?? "this server"
              } for ${FormatDuration(length, unit)}${
                reason ? `: ${reason}` : ""
              }`,
            )
            .then(
              () => {},
              () => {
                dmFailed = true;
                context.logger.Warn("Failed to send DM notification", {
                  userId: targetUser.id,
                  reason: "User may have DMs disabled or the bot blocked",
                });
              },
            );
        }
      },
    });
  } else if (subcommand === "clear") {
    let dmFailed = false;

    await interactionResponder.WithAction({
      interaction,
      message: {
        embeds: [
          EmbedFactory.Create({
            title: "⏳ Processing Unmute",
            description: `Removing timeout from ${targetUser.username}...`,
            color: 0x5865f2,
          }),
        ],
      },
      followUp: () => {
        const embed = EmbedFactory.CreateSuccess({
          title: "Mute Removed",
          description: `Successfully removed mute from **${targetUser.username}**`,
        });

        if (reason !== "No reason provided") {
          embed.addFields([{ name: "Reason", value: reason, inline: false }]);
        }

        if (dmFailed) {
          embed.setFooter({
            text: "⚠️ Could not send DM notification to user",
          });
        }

        return {
          embeds: [embed],
        };
      },
      action: async () => {
        const targetMember = await locator.GetMember(targetUser.id);

        if (!targetMember) {
          throw new Error("User is not a member of this server.");
        }

        await targetMember.timeout(null, reason || "Mute cleared");

        if (notify) {
          interactionResponder
            .SendDm(
              targetUser,
              `Your mute has been removed in ${
                interaction.guild?.name ?? "this server"
              }${reason ? `: ${reason}` : ""}`,
            )
            .then(
              () => {},
              () => {
                dmFailed = true;
                context.logger.Warn("Failed to send DM notification", {
                  userId: targetUser.id,
                  reason: "User may have DMs disabled or the bot blocked",
                });
              },
            );
        }
      },
    });
  }
}

export const MuteCommand = CreateCommand({
  name: "mute",
  description: "Mute a user or remove their mute",
  group: "moderation",
  configure: (builder) => {
    builder
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Apply a timeout to a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user to mute")
              .setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("length")
              .setDescription("Duration length")
              .setRequired(true)
              .setMinValue(1),
          )
          .addStringOption((option) =>
            option
              .setName("unit")
              .setDescription("Duration unit")
              .setRequired(true)
              .addChoices(
                { name: "Seconds", value: "seconds" },
                { name: "Minutes", value: "minutes" },
                { name: "Hours", value: "hours" },
                { name: "Days", value: "days" },
              ),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for muting")
              .setRequired(false),
          )
          .addBooleanOption((option) =>
            option
              .setName("notify")
              .setDescription("Send DM notification to user"),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("clear")
          .setDescription("Remove a timeout from a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user to unmute")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for removing timeout")
              .setRequired(false),
          )
          .addBooleanOption((option) =>
            option
              .setName("notify")
              .setDescription("Send DM notification to user"),
          ),
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.create()
    .permissions("ModerateMembers")
    .cooldownSeconds(5)
    .build(),
  execute: ExecuteMute,
});
