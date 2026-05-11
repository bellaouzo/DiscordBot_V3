import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { Appeal, AppealActionType, AppealStatus } from "@database";
import {
  AppealableActionOption,
  ComponentFactory,
  CreateAppealManager,
  CreateChannelManager,
  EmbedFactory,
  ToActionRowData,
} from "@utilities";

async function ExecuteAppeal(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === "submit") {
    await HandleSubmit(interaction, context);
    return;
  }

  if (subcommand === "my") {
    await HandleMyAppeals(interaction, context);
    return;
  }

  if (subcommand === "review") {
    await HandleReview(interaction, context);
    return;
  }
}

function IsAppealReviewer(
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

function BuildActionOptionValue(option: AppealableActionOption): string {
  return `${option.actionType}:${option.actionRef}`;
}

function ParseActionOptionValue(
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

async function BuildActionSelectOptions(
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

async function ProcessAppealSubmission(data: {
  modalInteraction: ModalSubmitInteraction;
  context: CommandContext;
  guild: Guild;
  reason: string;
  evidence: string | null;
  target: AppealableActionOption;
}): Promise<void> {
  const { modalInteraction, context, guild, reason, evidence, target } = data;
  const { componentRouter } = context.responders;

  const appealManager = CreateAppealManager({
    guildId: guild.id,
    userId: modalInteraction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const validation = appealManager.ValidateTarget({
    actionType: target.actionType,
    actionRef: target.actionRef,
  });
  if (!validation.success || !validation.target) {
    await modalInteraction.editReply({
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Unable to Submit Appeal",
          description: validation.message ?? "Could not validate selected action.",
        }).toJSON(),
      ],
    });
    return;
  }

  const appeal = appealManager.CreateAppeal({
    actionType: validation.target.actionType,
    actionRef: validation.target.actionRef,
    reason,
    evidence,
  });

  const createdReview = await CreateAppealReviewChannel({
    guild,
    requesterId: modalInteraction.user.id,
    requesterUsername: modalInteraction.user.username,
    context,
    appeal,
    contextLine: validation.target.context,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Appeal Submitted",
    description: `Your appeal #${appeal.id} was created for **${validation.target.actionType.toUpperCase()}**.`,
  });
  embed.addFields([
    { name: "Guild", value: guild.name, inline: true },
    { name: "Target", value: validation.target.context, inline: false },
    { name: "Appeal Reason", value: reason, inline: false },
    { name: "Evidence", value: evidence ?? "None provided", inline: false },
    {
      name: "Staff Review",
      value: createdReview
        ? `Created in ${createdReview.channel}`
        : "Queued (review channel could not be created automatically)",
      inline: false,
    },
  ]);
  await modalInteraction.editReply({ embeds: [embed.toJSON()] });

  if (!createdReview) {
    context.logger.Warn("Appeal review channel was not created", {
      extra: { appealId: appeal.id, guildId: guild.id },
    });
    return;
  }

  const approve = componentRouter.RegisterButton({
    handler: async (btn) => {
      await HandleAppealDecisionButton(btn, context, appeal.id, "approved");
    },
    expiresInMs: 1000 * 60 * 60 * 24 * 7,
  });
  const deny = componentRouter.RegisterButton({
    handler: async (btn) => {
      await HandleAppealDecisionButton(btn, context, appeal.id, "denied");
    },
    expiresInMs: 1000 * 60 * 60 * 24 * 7,
  });

  const actionRow = ComponentFactory.CreateActionRow({
    buttons: [
      { label: "Approve", style: ButtonStyle.Success },
      { label: "Deny", style: ButtonStyle.Danger },
    ],
    customIds: [approve.customId, deny.customId],
  });

  const reviewEmbed = BuildAppealReviewEmbed({
    appeal,
    guildName: guild.name,
    userTag: modalInteraction.user.tag,
    contextLine: validation.target.context,
  });

  const reviewMessage = await createdReview.channel.send({
    content: `<@${modalInteraction.user.id}>`,
    embeds: [reviewEmbed.toJSON()],
    components: [actionRow.toJSON()],
  });

  context.databases.moderationDb.UpdateAppealReviewMessage({
    id: appeal.id,
    review_channel_id: createdReview.channel.id,
    review_message_id: reviewMessage.id,
  });
}

async function HandleSubmit(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, selectMenuRouter, modalRouter } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeals can only be submitted inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const requestedAction = interaction.options.getString("action") as
    | "warning"
    | "mute"
    | "ban"
    | "kick"
    | null;
  const guild = interaction.guild;

  const appealManager = CreateAppealManager({
    guildId: guild.id,
    userId: interaction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const options = appealManager.ListAppealableActions(requestedAction ?? undefined);
  if (options.length === 0) {
    const detail = requestedAction
      ? `You do not have any ${requestedAction} records to appeal.`
      : "You do not have any warnings, mutes, bans, or kicks to appeal.";
    const embed = EmbedFactory.CreateWarning({
      title: "Nothing To Appeal",
      description: detail,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const selectOptions = await BuildActionSelectOptions(
    options,
    guild,
    interaction.client
  );
  const customId = `appeal-select:${interaction.id}`;
  const menu = ComponentFactory.CreateSelectMenu({
    customId,
    placeholder: "Select the action you want to appeal...",
    minValues: 1,
    maxValues: 1,
    options: selectOptions,
  });
  selectMenuRouter.RegisterSelectMenu({
    customId,
    ownerId: interaction.user.id,
    singleUse: true,
    expiresInMs: 1000 * 60 * 2,
    handler: async (selectInteraction) => {
      const parsed = ParseActionOptionValue(selectInteraction.values[0]);
      if (!parsed) {
        await selectInteraction.reply({
          embeds: [
            EmbedFactory.CreateError({
              title: "Invalid Selection",
              description: "Could not parse the selected action.",
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const chosen = options.find(
        (entry) =>
          entry.actionType === parsed.actionType &&
          entry.actionRef === parsed.actionRef
      );
      if (!chosen) {
        await selectInteraction.reply({
          embeds: [
            EmbedFactory.CreateWarning({
              title: "Selection Expired",
              description: "That moderation action is no longer available.",
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const modalCustomId = `appeal-reason:${interaction.id}:${chosen.actionType}:${chosen.actionRef}`;
      const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle("Submit Appeal");
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Why should this action be appealed?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      const evidenceInput = new TextInputBuilder()
        .setCustomId("evidence")
        .setLabel("Evidence (optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput)
      );

      modalRouter.RegisterModal({
        customId: modalCustomId,
        ownerId: interaction.user.id,
        singleUse: true,
        expiresInMs: 1000 * 60 * 5,
        handler: async (modalInteraction) => {
          const reason = modalInteraction.fields.getTextInputValue("reason").trim();
          const evidenceRaw = modalInteraction.fields
            .getTextInputValue("evidence")
            .trim();
          const evidence = evidenceRaw.length > 0 ? evidenceRaw : null;

          await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });
          await ProcessAppealSubmission({
            modalInteraction,
            context,
            guild,
            reason,
            evidence,
            target: chosen,
          });
        },
      });

      await selectInteraction.showModal(modal);
    },
  });

  const embed = EmbedFactory.Create({
    title: "Select Action To Appeal",
    description: `Found **${options.length}** moderation action(s). Choose one below, then fill out your reason and evidence in the next step.`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    components: [ToActionRowData(ComponentFactory.CreateSelectMenuRow(menu))],
    ephemeral: true,
  });
}

async function CreateAppealReviewChannel(data: {
  guild: Guild;
  requesterId: string;
  requesterUsername: string;
  context: CommandContext;
  appeal: Appeal;
  contextLine: string;
}): Promise<{ channel: TextChannel } | null> {
  const { guild, context, requesterId, requesterUsername, appeal, contextLine } =
    data;
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const channelManager = CreateChannelManager({ guild, logger: context.logger });
  const fallbackCategory = await channelManager.GetOrCreateCategory("Appeals");

  let parentCategoryId =
    settings?.appeal_review_category_id ??
    settings?.ticket_category_id ??
    fallbackCategory?.id ??
    null;
  if (parentCategoryId) {
    const parent = guild.channels.cache.get(parentCategoryId);
    if (!parent || parent.type !== ChannelType.GuildCategory) {
      parentCategoryId = fallbackCategory?.id ?? null;
    }
  }

  const botMember = await guild.members.fetchMe();
  const requesterMember = await guild.members
    .fetch(requesterId)
    .catch(() => null);

  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (requesterMember) {
    permissionOverwrites.push({
      id: requesterMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const reviewerRoleIds = new Set([
    ...(settings?.admin_role_ids ?? []),
    ...(settings?.mod_role_ids ?? []),
  ]);
  reviewerRoleIds.forEach((roleId) => {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  });

  const safeUsername = requesterUsername
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 20);
  const channel = await guild.channels
    .create({
      name: `appeal-${appeal.id}-${safeUsername || "user"}`,
      type: ChannelType.GuildText,
      parent: parentCategoryId,
      permissionOverwrites,
      topic: `Appeal #${appeal.id} | ${contextLine}`,
    })
    .catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return null;
  }

  return { channel };
}

function BuildAppealReviewEmbed(data: {
  appeal: Appeal;
  guildName: string;
  userTag: string;
  contextLine: string;
}) {
  const embed = EmbedFactory.Create({
    title: `Appeal #${data.appeal.id} — ${data.appeal.action_type.toUpperCase()}`,
    description: `Appeal submitted by **${data.userTag}** in **${data.guildName}**.`,
  });

  embed.addFields([
    { name: "User", value: `<@${data.appeal.user_id}>`, inline: true },
    { name: "Status", value: data.appeal.status.toUpperCase(), inline: true },
    {
      name: "Submitted",
      value: `<t:${Math.floor(data.appeal.created_at / 1000)}:f>`,
      inline: true,
    },
    {
      name: "Target",
      value: data.contextLine,
      inline: false,
    },
    {
      name: "Appeal Reason",
      value: data.appeal.reason,
      inline: false,
    },
  ]);

  if (data.appeal.evidence) {
    embed.addFields([{ name: "Evidence", value: data.appeal.evidence, inline: false }]);
  }

  return embed;
}

async function HandleAppealDecisionButton(
  interaction: ButtonInteraction,
  context: CommandContext,
  appealId: number,
  status: Exclude<AppealStatus, "open">
): Promise<void> {
  const { buttonResponder } = context.responders;
  const guild = interaction.guild;
  if (!guild) {
    await buttonResponder.Reply(interaction, {
      content: "Appeal decisions can only be processed in a server.",
      ephemeral: true,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const member = interaction.member as GuildMember | null;
  if (
    !IsAppealReviewer(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    await buttonResponder.Reply(interaction, {
      content: "You do not have permission to resolve appeals.",
      ephemeral: true,
    });
    return;
  }

  const resolved = context.databases.moderationDb.ResolveAppeal({
    id: appealId,
    status,
    resolved_by: interaction.user.id,
    resolved_reason: `Resolved via ${status} button.`,
  });

  if (!resolved) {
    await buttonResponder.Reply(interaction, {
      content: "This appeal is already resolved or no longer exists.",
      ephemeral: true,
    });
    return;
  }

  let removalDetail = "No moderation action was removed.";
  if (status === "approved") {
    const removal = await RemoveAppealedAction(guild, context, resolved);
    removalDetail = removal.message;
  }

  const updatedEmbed = EmbedFactory.Create({
    title: `Appeal #${resolved.id} — ${resolved.action_type.toUpperCase()}`,
    description: `Appeal has been **${status.toUpperCase()}**.`,
  });
  updatedEmbed.addFields([
    { name: "User", value: `<@${resolved.user_id}>`, inline: true },
    { name: "Resolved By", value: `<@${interaction.user.id}>`, inline: true },
    {
      name: "Resolved At",
      value: `<t:${Math.floor((resolved.resolved_at ?? Date.now()) / 1000)}:f>`,
      inline: true,
    },
    {
      name: "Reason",
      value: resolved.reason,
      inline: false,
    },
  ]);
  if (status === "approved") {
    updatedEmbed.addFields([
      {
        name: "Action Update",
        value: removalDetail,
        inline: false,
      },
    ]);
  }

  await buttonResponder.Update(interaction, {
    embeds: [updatedEmbed.toJSON()],
    components: [],
  });

  await NotifyAppealUser(interaction.client, resolved, status, {
    guildName: guild.name,
    removalDetail,
  });

  if (
    status === "approved" &&
    interaction.channel?.isTextBased() &&
    interaction.channel.type === ChannelType.GuildText
  ) {
    await PostApprovedChannelMessage(
      context,
      interaction.channel,
      resolved,
      removalDetail
    );
  }
}

async function NotifyAppealUser(
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

async function RemoveAppealedAction(
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

async function PostApprovedChannelMessage(
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

async function HandleMyAppeals(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeal history can only be viewed inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }
  const guild = interaction.guild;

  const manager = CreateAppealManager({
    guildId: guild.id,
    userId: interaction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const appeals = manager.ListAppeals();
  if (appeals.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Appeals",
      description: "You have not submitted any appeals in this guild.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const embed = EmbedFactory.Create({
    title: `Your Appeals in ${guild.name}`,
    description: `Showing ${Math.min(appeals.length, 10)} of ${appeals.length} appeals.`,
  });
  embed.addFields(
    appeals.slice(0, 10).map((appeal) => ({
      name: `#${appeal.id} — ${appeal.action_type.toUpperCase()}`,
      value: `Status: **${appeal.status.toUpperCase()}**\nTarget: ${
        appeal.action_ref ?? "n/a"
      }\nCreated: <t:${Math.floor(appeal.created_at / 1000)}:R>`,
      inline: false,
    }))
  );

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleReview(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeal review can only be done inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(interaction.guild.id);
  const member = interaction.member as GuildMember | null;
  if (
    !IsAppealReviewer(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to review appeals.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const appealId = interaction.options.getInteger("appeal_id", true);
  const decision = interaction.options.getString("decision", true) as
    | "approved"
    | "denied";
  const reviewReason = interaction.options.getString("review_reason");

  const resolved = context.databases.moderationDb.ResolveAppeal({
    id: appealId,
    status: decision,
    resolved_by: interaction.user.id,
    resolved_reason: reviewReason ?? `Resolved by /appeal review (${decision})`,
  });

  if (!resolved) {
    const embed = EmbedFactory.CreateWarning({
      title: "Appeal Not Open",
      description: "Appeal not found or it has already been resolved.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  let removalDetail = "No moderation action was removed.";
  if (decision === "approved") {
    const removal = await RemoveAppealedAction(interaction.guild, context, resolved);
    removalDetail = removal.message;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Appeal Resolved",
    description: `Appeal #${resolved.id} was **${decision.toUpperCase()}**.`,
  });
  embed.addFields([
    { name: "User", value: `<@${resolved.user_id}>`, inline: true },
    { name: "Action", value: resolved.action_type.toUpperCase(), inline: true },
    { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
  ]);
  if (resolved.resolved_reason) {
    embed.addFields([
      { name: "Resolution Reason", value: resolved.resolved_reason, inline: false },
    ]);
  }
  if (decision === "approved") {
    embed.addFields([
      { name: "Action Update", value: removalDetail, inline: false },
    ]);
  }

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });

  await NotifyAppealUser(interaction.client, resolved, decision, {
    guildName: interaction.guild.name,
    removalDetail,
  });

  if (!resolved.review_channel_id || !resolved.review_message_id) {
    return;
  }

  const channel = await interaction.guild.channels
    .fetch(resolved.review_channel_id)
    .catch(() => null);
  if (
    !channel ||
    !channel.isTextBased() ||
    !("messages" in channel) ||
    channel.type !== ChannelType.GuildText
  ) {
    return;
  }

  const message = await channel.messages
    .fetch(resolved.review_message_id)
    .catch(() => null);
  if (!message) {
    return;
  }

  const reviewEmbed = EmbedFactory.Create({
    title: `Appeal #${resolved.id} — ${resolved.action_type.toUpperCase()}`,
    description: `Appeal has been **${decision.toUpperCase()}**.`,
  });
  reviewEmbed.addFields([
    { name: "Resolved By", value: `<@${interaction.user.id}>`, inline: true },
    {
      name: "Resolved At",
      value: `<t:${Math.floor((resolved.resolved_at ?? Date.now()) / 1000)}:f>`,
      inline: true,
    },
  ]);
  if (resolved.resolved_reason) {
    reviewEmbed.addFields([
      {
        name: "Resolution Reason",
        value: resolved.resolved_reason,
        inline: false,
      },
    ]);
  }
  if (decision === "approved") {
    reviewEmbed.addFields([
      { name: "Action Update", value: removalDetail, inline: false },
    ]);
  }

  await message.edit({ embeds: [reviewEmbed.toJSON()], components: [] }).catch(() => {});

  if (decision === "approved") {
    await PostApprovedChannelMessage(
      context,
      channel,
      resolved,
      removalDetail
    );
  }
}

export const AppealCommand = CreateCommand({
  name: "appeal",
  description: "Submit and review moderation appeals",
  group: "moderation",
  config: Config.create().guildOnly().cooldownSeconds(10).build(),
  execute: ExecuteAppeal,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("submit")
          .setDescription("Start a guided moderation appeal")
          .addStringOption((option) =>
            option
              .setName("action")
              .setDescription("Optional: only appeal this action type")
              .setRequired(false)
              .addChoices(
                { name: "Warning", value: "warning" },
                { name: "Mute", value: "mute" },
                { name: "Ban", value: "ban" },
                { name: "Kick", value: "kick" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("my").setDescription("View your submitted appeals")
      )
      .addSubcommand((sub) =>
        sub
          .setName("review")
          .setDescription("Resolve an appeal (staff)")
          .addIntegerOption((option) =>
            option
              .setName("appeal_id")
              .setDescription("Appeal ID to resolve")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("decision")
              .setDescription("Resolution decision")
              .setRequired(true)
              .addChoices(
                { name: "Approve", value: "approved" },
                { name: "Deny", value: "denied" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("review_reason")
              .setDescription("Reason for approval or denial")
              .setRequired(false)
          )
      );
  },
});
