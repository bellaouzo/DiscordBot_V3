import type {
  ChatInputCommandInteraction,
  GuildMember,
  User,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand, CreateUserMenu } from "@commands";
import type { RepliableInteraction } from "@responders";
import { PromptModal } from "@shared/ModalPrompt";
import type { DurationUnit } from "@utilities";
import {
  RequireGuild,
  RequireGuildFromInteraction,
  EmbedFactory,
  CreateGuildResourceLocator,
  ConvertDurationToMs,
  FormatDuration,
  ParseDuration,
} from "@utilities";

const MAX_MUTE_MS = 28 * 24 * 60 * 60 * 1000;

function ValidateTargetMember(
  targetMember: GuildMember | null | undefined,
  interaction: RepliableInteraction,
): string | null {
  if (!targetMember?.moderatable) {
    return "I cannot timeout this user. They may be the server owner or have higher permissions than me.";
  }

  if (targetMember.id === interaction.user.id) {
    return "You cannot timeout yourself.";
  }

  if (targetMember.id === interaction.client.user.id) {
    return "I cannot timeout myself.";
  }

  return null;
}

/**
 * Times the user out, records the temp action and optionally DMs them. Shared by `/mute set`
 * and the Mute right-click menu. `durationMs` must already be validated.
 */
async function MuteUser(options: {
  readonly interaction: RepliableInteraction;
  readonly context: CommandContext;
  readonly targetUser: User;
  readonly durationMs: number;
  /** Shown to the moderator and in the DM, e.g. "10 minutes". */
  readonly durationLabel: string;
  readonly reason: string;
  readonly notify: boolean;
}): Promise<void> {
  const {
    interaction,
    context,
    targetUser,
    durationMs,
    durationLabel,
    reason,
    notify,
  } = options;
  const { interactionResponder } = context.responders;
  const guild = RequireGuildFromInteraction(interaction);
  const locator = CreateGuildResourceLocator({
    guild,
    logger: context.logger,
  });

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
        }** for ${durationLabel}`,
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
      const validationError = ValidateTargetMember(targetMember, interaction);
      if (validationError) {
        throw new Error(validationError);
      }

      await targetMember.timeout(durationMs, reason);

      context.databases.moderationDb.AddTempAction({
        action: "mute",
        guild_id: guild.id,
        user_id: targetUser.id,
        moderator_id: interaction.user.id,
        reason,
        expires_at: Date.now() + durationMs,
      });

      if (notify) {
        interactionResponder
          .SendDm(
            targetUser,
            `You have been muted in ${
              interaction.guild?.name ?? "this server"
            } for ${durationLabel}${reason ? `: ${reason}` : ""}`,
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

async function ExecuteMute(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  const guild = RequireGuild(interaction);

  const targetUser = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const notify = interaction.options.getBoolean("notify") ?? false;
  const subcommand = interaction.options.getSubcommand();

  const locator = CreateGuildResourceLocator({
    guild,
    logger,
  });

  if (subcommand === "set") {
    const length = interaction.options.getInteger("length", true);
    const unit = interaction.options.getString("unit", true) as DurationUnit;

    const durationMs = ConvertDurationToMs(length, unit);
    if (durationMs <= 0 || durationMs > MAX_MUTE_MS) {
      const errorEmbed = EmbedFactory.CreateError({
        title: "Invalid Duration",
        description: "Duration must be between 1 second and 28 days.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await MuteUser({
      interaction,
      context,
      targetUser,
      durationMs,
      durationLabel: FormatDuration(length, unit),
      reason,
      notify,
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

        const muteExpiresAt = targetMember.communicationDisabledUntilTimestamp;
        if (!muteExpiresAt || muteExpiresAt <= Date.now()) {
          throw new Error("User is not currently muted.");
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
  config: {
    access: "mod",
    cooldown: "5s",
    botPermissions: ["ModerateMembers"],
  },
  execute: ExecuteMute,
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
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for muting")
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
});

/** Right-click a user → Apps → Mute: asks for a duration and reason, then times them out. */
export const MuteUserMenu = CreateUserMenu({
  name: "Mute",
  command: MuteCommand,
  subcommand: "set",
  execute: async (interaction, context) => {
    const targetUser = interaction.targetUser;
    await PromptModal({
      interaction,
      modalRouter: context.responders.modalRouter,
      title: `Mute ${targetUser.username}`,
      fields: [
        {
          id: "duration",
          label: "Duration (e.g. 10m, 2h, 1d)",
          required: true,
          placeholder: "10m",
          maxLength: 10,
        },
        {
          id: "reason",
          label: "Reason",
          style: "paragraph",
          placeholder: "Leave empty for no reason",
          maxLength: 500,
        },
      ],
      onSubmit: async (submit, values) => {
        const durationMs = ParseDuration(values.duration);
        if (!durationMs || durationMs > MAX_MUTE_MS) {
          await context.responders.interactionResponder.Reply(submit, {
            embeds: [
              EmbedFactory.CreateError({
                title: "Invalid Duration",
                description:
                  "Use a duration like `10m`, `2h` or `1d`, up to 28 days.",
              }).toJSON(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await MuteUser({
          interaction: submit,
          context,
          targetUser,
          durationMs,
          durationLabel: values.duration,
          reason: values.reason || "No reason provided",
          notify: false,
        });
      },
    });
  },
});
