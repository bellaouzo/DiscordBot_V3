import {
  ButtonStyle,
  Client,
  Guild,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { CommandContext } from "@commands";
import { Appeal, AppealActionType, AppealStatus } from "@database";
import {
  AppealableActionOption,
  ComponentFactory,
  EmbedFactory,
  ToActionRowData,
} from "@utilities";

export function IsAppealReviewer(
  member: GuildMember | null,
  options?: {
    adminRoleIds?: string[];
    modRoleIds?: string[];
  }
): boolean {
  if (!member) {
    return false;
  }

  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers)
  ) {
    return true;
  }

  const configuredRoleIds = new Set([
    ...(options?.adminRoleIds ?? []),
    ...(options?.modRoleIds ?? []),
  ]);

  return member.roles.cache.some((role) => configuredRoleIds.has(role.id));
}

export function BuildActionOptionValue(option: AppealableActionOption): string {
  return `${option.actionType}:${option.actionRef}`;
}

export function ParseActionOptionValue(
  value: string
): { actionType: AppealActionType; actionRef: string } | null {
  const parts = value.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const actionType = parts[0];
  const actionRef = parts[1];
  if (
    actionType !== "warning" &&
    actionType !== "mute" &&
    actionType !== "ban" &&
    actionType !== "kick"
  ) {
    return null;
  }

  return { actionType, actionRef };
}

export async function BuildActionSelectOptions(
  options: AppealableActionOption[],
  guild: Guild,
  client: Client
): Promise<Array<{ label: string; description: string; value: string }>> {
  const limited = options.slice(0, 25);
  const labelCache = new Map<string, string>();
  const perTypeCount = new Map<AppealActionType, number>();

  const resolveModeratorLabel = async (moderatorId: string): Promise<string> => {
    const cached = labelCache.get(moderatorId);
    if (cached) {
      return cached;
    }

    let username = "Unknown";
    const member = await guild.members.fetch(moderatorId).catch(() => null);
    if (member) {
      username = member.user.username;
    } else {
      const user = await client.users.fetch(moderatorId).catch(() => null);
      if (user) {
        username = user.username;
      }
    }

    const label = `${username} (${moderatorId})`;
    labelCache.set(moderatorId, label);
    return label;
  };

  const built: Array<{ label: string; description: string; value: string }> = [];
  for (const entry of limited) {
    const current = perTypeCount.get(entry.actionType) ?? 0;
    const displayNumber = current + 1;
    perTypeCount.set(entry.actionType, displayNumber);

    const modLabel = await resolveModeratorLabel(entry.moderatorId);
    const reasonPart = entry.preview.split("|")[1]?.trim() ?? "No reason provided";

    built.push({
      label: `${entry.actionType.toUpperCase()} #${displayNumber}`.slice(0, 100),
      description: `Mod: ${modLabel} | ${reasonPart}`.slice(0, 100),
      value: BuildActionOptionValue(entry),
    });
  }

  return built;
}

export async function NotifyAppealUser(
  client: Client,
  appeal: Appeal,
  status: Exclude<AppealStatus, "open">,
  extras?: {
    guildName?: string;
    removalDetail?: string;
  }
): Promise<void> {
  try {
    const user = await client.users.fetch(appeal.user_id);
    if (status === "approved") {
      const embed = EmbedFactory.CreateSuccess({
        title: "Appeal Approved",
        description: `Your appeal #${appeal.id} has been approved.`,
      });
      embed.addFields([
        {
          name: "Server",
          value: extras?.guildName ?? appeal.guild_id,
          inline: true,
        },
        {
          name: "Action",
          value: appeal.action_type.toUpperCase(),
          inline: true,
        },
        {
          name: "Result",
          value: extras?.removalDetail ?? "The moderation action was removed.",
          inline: false,
        },
      ]);
      await user.send({ embeds: [embed.toJSON()] });
      return;
    }

    const embed = EmbedFactory.CreateWarning({
      title: "Appeal Denied",
      description: `Your appeal #${appeal.id} was denied by staff.`,
    });
    embed.addFields([
      {
        name: "Server",
        value: extras?.guildName ?? appeal.guild_id,
        inline: true,
      },
      {
        name: "Action",
        value: appeal.action_type.toUpperCase(),
        inline: true,
      },
    ]);
    await user.send({ embeds: [embed.toJSON()] });
  } catch {
    // noop
  }
}

export async function RemoveAppealedAction(
  guild: Guild,
  context: CommandContext,
  appeal: Appeal
): Promise<{ removed: boolean; message: string }> {
  const actionRef = Number(appeal.action_ref);
  if (!Number.isInteger(actionRef) || actionRef <= 0) {
    return { removed: false, message: "Appealed record ID was invalid." };
  }

  if (appeal.action_type === "warning") {
    const removed = context.databases.userDb.RemoveWarningById(actionRef, guild.id);
    return removed
      ? { removed: true, message: `Warning #${actionRef} was removed.` }
      : { removed: false, message: "Could not remove that warning record." };
  }

  if (appeal.action_type === "mute") {
    const removedMute = context.databases.moderationDb.RemoveTempActionById(actionRef);
    const member = await guild.members.fetch(appeal.user_id).catch(() => null);
    let timeoutCleared = false;
    if (member?.communicationDisabledUntilTimestamp) {
      await member.timeout(null, "Appeal approved - mute removed").catch(() => {});
      timeoutCleared = true;
    }
    if (removedMute && timeoutCleared) {
      return {
        removed: true,
        message: `Mute #${actionRef} was removed and active timeout was cleared.`,
      };
    }
    if (removedMute) {
      return { removed: true, message: `Mute #${actionRef} record was removed.` };
    }
    if (timeoutCleared) {
      return {
        removed: true,
        message: "Active timeout was cleared, but mute record could not be removed.",
      };
    }
    return { removed: false, message: "Could not remove that mute action." };
  }

  if (appeal.action_type === "ban") {
    const eventRemoved = context.databases.moderationDb.RemoveModerationEventById({
      id: actionRef,
      guild_id: guild.id,
      action: "ban",
    });
    const unbanned = await guild.members
      .unban(appeal.user_id, "Appeal approved - ban removed")
      .then(() => true)
      .catch(() => false);
    if (unbanned && eventRemoved) {
      return {
        removed: true,
        message: `Ban #${actionRef} was lifted and record removed.`,
      };
    }
    if (unbanned) {
      return { removed: true, message: "Ban was lifted." };
    }
    if (eventRemoved) {
      return {
        removed: true,
        message: "Ban event record was removed, but unban could not be confirmed.",
      };
    }
    return { removed: false, message: "Could not remove or lift that ban." };
  }

  const removedKick = context.databases.moderationDb.RemoveModerationEventById({
    id: actionRef,
    guild_id: guild.id,
    action: "kick",
  });
  return removedKick
    ? {
        removed: true,
        message: `Kick #${actionRef} cannot be undone, but its record was removed.`,
      }
    : { removed: false, message: "Could not remove that kick record." };
}

export async function PostApprovedChannelMessage(
  context: CommandContext,
  channel: TextChannel,
  appeal: Appeal,
  removalDetail: string
): Promise<void> {
  const deleteRegistration = context.responders.componentRouter.RegisterButton({
    expiresInMs: 1000 * 60 * 60 * 24,
    handler: async (btn) => {
      const guild = btn.guild;
      if (!guild) {
        return;
      }

      const settings = context.databases.serverDb.GetGuildSettings(guild.id);
      const member = btn.member as GuildMember | null;
      if (
        !IsAppealReviewer(member, {
          adminRoleIds: settings?.admin_role_ids,
          modRoleIds: settings?.mod_role_ids,
        })
      ) {
        await context.responders.buttonResponder.Reply(btn, {
          content: "You do not have permission to delete this appeal channel.",
          ephemeral: true,
        });
        return;
      }

      await btn.reply({
        content: "Deleting appeal channel...",
        flags: MessageFlags.Ephemeral,
      });
      await btn.channel?.delete("Appeal approved and closed").catch(() => {});
    },
  });

  const deleteRow = ComponentFactory.CreateActionRow({
    buttons: [{ label: "Delete Channel", style: ButtonStyle.Danger, emoji: "🗑️" }],
    customIds: [deleteRegistration.customId],
  });

  const approvalEmbed = EmbedFactory.CreateSuccess({
    title: "Appeal Approved",
    description:
      "This appeal has been approved. The action was removed, and this channel can now be deleted.",
  });
  approvalEmbed.addFields([
    { name: "Appeal", value: `#${appeal.id}`, inline: true },
    { name: "User", value: `<@${appeal.user_id}>`, inline: true },
    { name: "Removed Action", value: removalDetail, inline: false },
  ]);

  await channel.send({
    embeds: [approvalEmbed.toJSON()],
    components: [ToActionRowData(deleteRow)],
  });
}
