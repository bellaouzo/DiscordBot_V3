import type { Client, Guild, TextChannel } from "discord.js";
import { ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import type { Appeal, AppealActionType, AppealStatus } from "@database";
import type { AppealableActionOption } from "@utilities";
import {
  ComponentFactory,
  EmbedFactory,
  IsAppealReviewer,
  ToActionRowData,
  ResolveInteractionMember,
} from "@utilities";

export { IsAppealReviewer };

export function BuildActionOptionValue(option: AppealableActionOption): string {
  return `${option.actionType}:${option.actionRef}`;
}

export function ParseActionOptionValue(
  value: string,
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
  client: Client,
): Promise<Array<{ label: string; description: string; value: string }>> {
  const limited = options.slice(0, 25);
  const labelCache = new Map<string, string>();

  const resolveModeratorLabel = async (
    moderatorId: string,
  ): Promise<string> => {
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

    labelCache.set(moderatorId, username);
    return username;
  };

  const built: Array<{ label: string; description: string; value: string }> =
    [];
  for (const entry of limited) {
    const modLabel = await resolveModeratorLabel(entry.moderatorId);
    const reasonPart =
      entry.preview.split("|")[1]?.trim() ?? "No reason provided";
    const dateLabel = new Date(entry.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const typeLabel =
      entry.actionType.charAt(0).toUpperCase() + entry.actionType.slice(1);

    built.push({
      label: `${typeLabel} — ${dateLabel}`.slice(0, 100),
      description: `${modLabel} · ${reasonPart}`.slice(0, 100),
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
  },
): Promise<void> {
  try {
    const user = await client.users.fetch(appeal.user_id);
    if (status === "approved") {
      const embed = EmbedFactory.CreateSuccess({
        title: "Appeal Approved",
        description: `Your appeal #${appeal.id} has been approved.`,
      });
      const fields = [
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
      ];
      if (appeal.resolved_reason) {
        fields.push({
          name: "Staff Note",
          value: appeal.resolved_reason,
          inline: false,
        });
      }
      embed.addFields(fields);
      await user.send({ embeds: [embed.toJSON()] });
      return;
    }

    const embed = EmbedFactory.CreateWarning({
      title: "Appeal Denied",
      description: `Your appeal #${appeal.id} was denied by staff.`,
    });
    const deniedFields = [
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
    ];
    if (appeal.resolved_reason) {
      deniedFields.push({
        name: "Staff Note",
        value: appeal.resolved_reason,
        inline: false,
      });
    }
    embed.addFields(deniedFields);
    await user.send({ embeds: [embed.toJSON()] });
  } catch {
    // noop
  }
}

export async function RemoveAppealedAction(
  guild: Guild,
  context: CommandContext,
  appeal: Appeal,
): Promise<{ removed: boolean; message: string }> {
  const actionRef = Number(appeal.action_ref);
  if (!Number.isInteger(actionRef) || actionRef <= 0) {
    return { removed: false, message: "Appealed record ID was invalid." };
  }

  if (appeal.action_type === "warning") {
    const removed = context.databases.userDb.RemoveWarningById(
      actionRef,
      guild.id,
    );
    return removed
      ? { removed: true, message: `Warning #${actionRef} was removed.` }
      : { removed: false, message: "Could not remove that warning record." };
  }

  if (appeal.action_type === "mute") {
    const removedMute =
      context.databases.moderationDb.RemoveTempActionById(actionRef);
    const member = await guild.members.fetch(appeal.user_id).catch(() => null);
    let timeoutCleared = false;
    if (member?.communicationDisabledUntilTimestamp) {
      await member
        .timeout(null, "Appeal approved - mute removed")
        .catch(() => {});
      timeoutCleared = true;
    }
    if (removedMute && timeoutCleared) {
      return {
        removed: true,
        message: `Mute #${actionRef} was removed and active timeout was cleared.`,
      };
    }
    if (removedMute) {
      return {
        removed: true,
        message: `Mute #${actionRef} record was removed.`,
      };
    }
    if (timeoutCleared) {
      return {
        removed: true,
        message:
          "Active timeout was cleared, but mute record could not be removed.",
      };
    }
    return { removed: false, message: "Could not remove that mute action." };
  }

  if (appeal.action_type === "ban") {
    const eventRemoved =
      context.databases.moderationDb.RemoveModerationEventById({
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
        message:
          "Ban event record was removed, but unban could not be confirmed.",
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

export async function PostResolvedChannelMessage(
  context: CommandContext,
  channel: TextChannel,
  appeal: Appeal,
  decision: Exclude<AppealStatus, "open">,
  removalDetail: string,
): Promise<void> {
  const closeRegistration = context.responders.componentRouter.RegisterButton({
    expiresInMs: 1000 * 60 * 60 * 24,
    handler: async (btn) => {
      const guild = btn.guild;
      if (!guild) {
        return;
      }

      const settings = context.databases.serverDb.GetGuildSettings(guild.id);
      const member = await ResolveInteractionMember(btn);
      if (
        !IsAppealReviewer(member, {
          adminRoleIds: settings?.admin_role_ids,
          modRoleIds: settings?.mod_role_ids,
        })
      ) {
        await context.responders.buttonResponder.Reply(btn, {
          content: "You do not have permission to close this appeal channel.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await btn.reply({
        content: "Closing appeal channel...",
        flags: MessageFlags.Ephemeral,
      });
      await btn.channel?.delete("Appeal resolved and closed").catch(() => {});
    },
  });

  const closeRow = ComponentFactory.CreateActionRow({
    buttons: [
      { label: "Close Channel", style: ButtonStyle.Danger, emoji: "🗑️" },
    ],
    customIds: [closeRegistration.customId],
  });

  const resolvedEmbed =
    decision === "approved"
      ? EmbedFactory.CreateSuccess({
          title: "Appeal Approved",
          description:
            "This appeal has been approved. The action was removed, and this channel can now be closed.",
        })
      : EmbedFactory.CreateWarning({
          title: "Appeal Denied",
          description:
            "This appeal has been denied. This channel can now be closed when review is complete.",
        });

  const fields = [
    { name: "Appeal", value: `#${appeal.id}`, inline: true },
    { name: "User", value: `<@${appeal.user_id}>`, inline: true },
  ];
  if (decision === "approved") {
    fields.push({
      name: "Removed Action",
      value: removalDetail,
      inline: false,
    });
  }
  if (appeal.resolved_reason) {
    fields.push({
      name: "Resolution Note",
      value: appeal.resolved_reason,
      inline: false,
    });
  }
  resolvedEmbed.addFields(fields);

  await channel.send({
    embeds: [resolvedEmbed.toJSON()],
    components: [ToActionRowData(closeRow)],
  });
}
