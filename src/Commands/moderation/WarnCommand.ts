import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory, CreateWarnManager } from "@utilities";
import { PaginationPage } from "@shared/Paginator";

const WARN_LIST_PAGE_SIZE = 6;

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

  const warnManager = CreateWarnManager({
    guildId: interaction.guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

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
}

async function HandleAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  warnManager: ReturnType<typeof CreateWarnManager>,
  isModerator: boolean
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!isModerator) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to warn users.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
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

  const warningNumber = totalWarnings;
  embed.addFields([
    { name: "Warning #", value: `${warningNumber}`, inline: true },
  ]);

  if (warning.reason) {
    embed.addFields([{ name: "Reason", value: warning.reason, inline: false }]);
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
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to remove warnings.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const warningId = interaction.options.getInteger("warning_id");

  if (warningId) {
    const warnings = warnManager.GetUserWarnings(targetUser.id);

    if (warningId < 1 || warningId > warnings.length) {
      const embed = EmbedFactory.CreateWarning({
        title: "Warning Not Found",
        description: `No warning found with number ${warningId}.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const warning = warnings[warningId - 1];

    const removed = warnManager.RemoveWarningById(warning.id);
    if (!removed) {
      const embed = EmbedFactory.CreateError({
        title: "Removal Failed",
        description: "Failed to remove the warning.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
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
    const embed = EmbedFactory.CreateWarning({
      title: "No Warnings",
      description: `${targetUser.tag} has no warnings to remove.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Latest Warning Removed",
    description: `Removed latest warning for **${targetUser.tag}**.`,
  });

  embed.addFields([{ name: "Warning #", value: "1 (latest)", inline: true }]);

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
  const { interactionResponder, paginatedResponder } = context.responders;
  const targetUser = interaction.options.getUser("user") ?? interaction.user;

  if (targetUser.id !== interaction.user.id && !isModerator) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You can only view your own warnings.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const warnings = warnManager.GetUserWarnings(targetUser.id);

  if (warnings.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Warnings",
      description: `${targetUser.tag} has no warnings.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const pages = BuildWarningPages(warnings, targetUser.tag);

  await paginatedResponder.Send({
    interaction,
    pages,
    ephemeral: true,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

function BuildWarningPages(
  warnings: ReturnType<ReturnType<typeof CreateWarnManager>["GetUserWarnings"]>,
  userTag: string
): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < warnings.length; index += WARN_LIST_PAGE_SIZE) {
    const slice = warnings.slice(index, index + WARN_LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: `Warnings for ${userTag}`,
      description: `Showing warnings ${start} - ${end} of ${warnings.length}`,
    });

    embed.addFields(
      slice.map((warning, sliceIndex) => {
        const date = new Date(warning.created_at).toLocaleDateString();
        const reason = warning.reason ?? "No reason provided";
        const warningNumber = start + sliceIndex;
        return {
          name: `#${warningNumber} — ${date}`,
          value: `Mod: <@${warning.moderator_id}>\nReason: ${reason}`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export const WarnCommand = CreateCommand({
  name: "warn",
  description: "Manage user warnings",
  group: "moderation",
  config: Config.mod(5).build(),
  execute: ExecuteWarn,
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
                "Specific warning number to remove (latest if omitted)"
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
});
