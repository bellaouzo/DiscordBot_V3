import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
import { PermissionMiddleware } from "../Middleware/PermissionMiddleware";
import { ErrorMiddleware } from "../Middleware/ErrorMiddleware";
import { Config } from "../Middleware/CommandConfig";
import { EmbedFactory, CreateWarnManager } from "../../Utilities";
import { TicketDatabase } from "../../Database";

function IsModerator(member: GuildMember | null): boolean {
  if (!member) return false;

  const permissions = member.permissions;
  return (
    permissions.has(PermissionFlagsBits.Administrator) ||
    permissions.has(PermissionFlagsBits.KickMembers) ||
    permissions.has(PermissionFlagsBits.BanMembers)
  );
}

async function ExecuteWarn(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const ticketDb = new TicketDatabase(context.logger);
  const warnManager = CreateWarnManager({
    guildId: interaction.guild.id,
    ticketDb,
    logger: context.logger,
  });

  try {
    const subcommand = interaction.options.getSubcommand(true);
    const member = interaction.member as GuildMember | null;
    const isModerator = IsModerator(member);

    if (subcommand === "add") {
      await HandleAdd(interaction, context, warnManager, isModerator);
      return;
    }

    if (subcommand === "remove") {
      await HandleRemove(interaction, context, warnManager, isModerator);
      return;
    }

    if (subcommand === "list") {
      await HandleList(interaction, context, warnManager, isModerator);
      return;
    }
  } finally {
    ticketDb.Close();
  }
}

async function HandleAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  warnManager: ReturnType<typeof CreateWarnManager>,
  isModerator: boolean
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!isModerator) {
    await interactionResponder.Reply(interaction, {
      content: "You do not have permission to warn users.",
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? null;

  const warning = warnManager.AddWarning({
    userId: targetUser.id,
    moderatorId: interaction.user.id,
    reason,
  });

  const totalWarnings = warnManager.CountWarnings(targetUser.id);
  const embed = EmbedFactory.CreateSuccess({
    title: "⚠️ Warning Added",
    description: `Warned **${targetUser.tag}**.`,
    footer: `Total warnings: ${totalWarnings}`,
  });

  if (warning.reason) {
    embed.addFields([
      { name: "Reason", value: warning.reason, inline: false },
      { name: "Warning ID", value: `${warning.id}`, inline: true },
    ]);
  } else {
    embed.addFields([
      { name: "Warning ID", value: `${warning.id}`, inline: true },
    ]);
  }

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  warnManager: ReturnType<typeof CreateWarnManager>,
  isModerator: boolean
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!isModerator) {
    await interactionResponder.Reply(interaction, {
      content: "You do not have permission to remove warnings.",
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const warningId = interaction.options.getInteger("warning_id");

  if (warningId) {
    const warning = warnManager.GetWarningById(warningId);
    if (!warning) {
      await interactionResponder.Reply(interaction, {
        content: `No warning found with ID ${warningId}.`,
        ephemeral: true,
      });
      return;
    }

    if (warning.user_id !== targetUser.id) {
      await interactionResponder.Reply(interaction, {
        content: "That warning does not belong to the specified user.",
        ephemeral: true,
      });
      return;
    }

    const removed = warnManager.RemoveWarningById(warningId);
    if (!removed) {
      await interactionResponder.Reply(interaction, {
        content: "Failed to remove the warning.",
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Warning Removed",
      description: `Removed warning **#${warningId}** for **${targetUser.tag}**.`,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const removedWarning = warnManager.RemoveLatestWarning(targetUser.id);
  if (!removedWarning) {
    await interactionResponder.Reply(interaction, {
      content: `${targetUser.tag} has no warnings to remove.`,
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Latest Warning Removed",
    description: `Removed latest warning for **${targetUser.tag}**.`,
  });

  embed.addFields([
    { name: "Warning ID", value: `${removedWarning.id}`, inline: true },
  ]);

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  warnManager: ReturnType<typeof CreateWarnManager>,
  isModerator: boolean
): Promise<void> {
  const { interactionResponder } = context.responders;
  const targetUser = interaction.options.getUser("user") ?? interaction.user;

  if (targetUser.id !== interaction.user.id && !isModerator) {
    await interactionResponder.Reply(interaction, {
      content: "You can only view your own warnings.",
      ephemeral: true,
    });
    return;
  }

  const warnings = warnManager.GetUserWarnings(targetUser.id);

  if (warnings.length === 0) {
    await interactionResponder.Reply(interaction, {
      content: `${targetUser.tag} has no warnings.`,
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.Create({
    title: `Warnings for ${targetUser.tag}`,
    description: warnings
      .slice(0, 10)
      .map((warning) => {
        const date = new Date(warning.created_at).toLocaleDateString();
        const reason = warning.reason ?? "No reason provided";
        return `• ID ${warning.id} — ${date} — Mod: <@${warning.moderator_id}>\n  Reason: ${reason}`;
      })
      .join("\n\n"),
    footer:
      warnings.length > 10
        ? `Showing 10 of ${warnings.length} warnings`
        : `Total warnings: ${warnings.length}`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const WarnCommand = CreateCommand({
  name: "warn",
  description: "Manage user warnings",
  group: "moderation",
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Warn a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to warn")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for the warning")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a user's warning")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User whose warning will be removed")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("warning_id")
              .setDescription(
                "Specific warning ID to remove (latest if omitted)"
              )
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("View warnings for yourself or another user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription(
                "User to view warnings for (defaults to yourself)"
              )
              .setRequired(false)
          )
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(2),
  execute: ExecuteWarn,
});
