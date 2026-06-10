import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CommandContext } from "@commands";
import { Appeal, AppealStatus } from "@database";
import { CreateAppealManager, EmbedFactory } from "@utilities";
import { PaginationPage } from "@shared/Paginator";
import {
  IsAppealReviewer,
  NotifyAppealUser,
  PostResolvedChannelMessage,
  RemoveAppealedAction,
} from "@commands/Moderation/Appeal/AppealShared";
import { BuildResolvedReviewEmbed } from "@commands/Moderation/Appeal/AppealFormatters";

const APPEAL_REVIEW_MODAL_TIMEOUT_MS = 1000 * 60 * 5;
const APPEAL_LIST_PAGE_SIZE = 10;

function BuildAppealListPages(appeals: Appeal[]): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < appeals.length; index += APPEAL_LIST_PAGE_SIZE) {
    const slice = appeals.slice(index, index + APPEAL_LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: "Open Appeals",
      description: `Showing ${start} - ${end} of ${appeals.length} open appeal(s).`,
    });

    embed.addFields(
      slice.map((appeal) => {
        const channelLink = appeal.review_channel_id
          ? `<#${appeal.review_channel_id}>`
          : "No review channel";
        return {
          name: `#${appeal.id} — ${appeal.action_type.toUpperCase()}`,
          value: `User: <@${appeal.user_id}>\nChannel: ${channelLink}\nCreated: <t:${Math.floor(appeal.created_at / 1000)}:R>`,
          inline: false,
        };
      })
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function FinalizeAppealDecision(data: {
  context: CommandContext;
  appealId: number;
  status: Exclude<AppealStatus, "open">;
  reviewerId: string;
  resolvedReason: string;
  guildId: string;
  client: ButtonInteraction["client"];
}): Promise<boolean> {
  const { context, appealId, status, reviewerId, resolvedReason, guildId, client } =
    data;

  const resolved = context.databases.moderationDb.ResolveAppeal({
    id: appealId,
    status,
    resolved_by: reviewerId,
    resolved_reason: resolvedReason,
  });

  if (!resolved) {
    return false;
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return false;
  }

  let removalDetail = "No moderation action was removed.";
  if (status === "approved") {
    const removal = await RemoveAppealedAction(guild, context, resolved);
    removalDetail = removal.message;
  }

  const updatedEmbed = BuildResolvedReviewEmbed({
    appeal: resolved,
    decision: status,
    reviewerId,
    removalDetail,
  });
  updatedEmbed.addFields([
    {
      name: "Reason",
      value: resolved.reason,
      inline: false,
    },
  ]);
  if (resolved.resolved_reason) {
    updatedEmbed.addFields([
      {
        name: "Resolution Note",
        value: resolved.resolved_reason,
        inline: false,
      },
    ]);
  }

  if (resolved.review_channel_id && resolved.review_message_id) {
    const channel = await guild.channels
      .fetch(resolved.review_channel_id)
      .catch(() => null);
    if (
      channel &&
      channel.isTextBased() &&
      "messages" in channel &&
      channel.type === ChannelType.GuildText
    ) {
      const message = await channel.messages
        .fetch(resolved.review_message_id)
        .catch(() => null);
      if (message) {
        await message.edit({ embeds: [updatedEmbed.toJSON()], components: [] }).catch(() => {});
      }
      await PostResolvedChannelMessage(
        context,
        channel,
        resolved,
        status,
        removalDetail
      );
    }
  }

  await NotifyAppealUser(client, resolved, status, {
    guildName: guild.name,
    removalDetail,
  });

  return true;
}

export async function HandleAppealDecisionButton(
  interaction: ButtonInteraction,
  context: CommandContext,
  appealId: number,
  status: Exclude<AppealStatus, "open">
): Promise<void> {
  const { buttonResponder, modalRouter } = context.responders;
  const guild = interaction.guild;
  if (!guild) {
    await buttonResponder.Reply(interaction, {
      content: "Appeal decisions can only be processed in a server.",
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const appeal = context.databases.moderationDb.GetAppealById(appealId);
  if (!appeal || appeal.status !== "open") {
    await buttonResponder.Reply(interaction, {
      content: "This appeal is already resolved or no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modalCustomId = `appeal-review:${interaction.id}:${appealId}:${status}`;
  const modal = new ModalBuilder()
    .setCustomId(modalCustomId)
    .setTitle(status === "approved" ? "Approve Appeal" : "Deny Appeal");
  const reasonInput = new TextInputBuilder()
    .setCustomId("review_reason")
    .setLabel("Resolution note (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
  );

  modalRouter.RegisterModal({
    customId: modalCustomId,
    ownerId: interaction.user.id,
    singleUse: true,
    expiresInMs: APPEAL_REVIEW_MODAL_TIMEOUT_MS,
    handler: async (modalInteraction) => {
      const reasonRaw = modalInteraction.fields
        .getTextInputValue("review_reason")
        .trim();
      const resolvedReason =
        reasonRaw.length > 0
          ? reasonRaw
          : status === "approved"
            ? "Approved by staff"
            : "Denied by staff";

      await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      const finalized = await FinalizeAppealDecision({
        context,
        appealId,
        status,
        reviewerId: modalInteraction.user.id,
        resolvedReason,
        guildId: guild.id,
        client: modalInteraction.client,
      });

      await modalInteraction.editReply({
        content: finalized
          ? `Appeal #${appealId} marked as **${status.toUpperCase()}**.`
          : "This appeal is already resolved or no longer exists.",
      });
    },
  });

  await interaction.showModal(modal);
}

export async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeal list can only be viewed inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
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
      description: "You do not have permission to view open appeals.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const manager = CreateAppealManager({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const appeals = manager.ListGuildOpenAppeals(100);
  if (appeals.length === 0) {
    const embed = EmbedFactory.Create({
      title: "Open Appeals",
      description: "There are no open appeals in this guild.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pages = BuildAppealListPages(appeals);

  if (appeals.length <= APPEAL_LIST_PAGE_SIZE) {
    await interactionResponder.Reply(interaction, {
      embeds: pages[0].embeds,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

export async function HandleReview(
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
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const appealId = interaction.options.getInteger("appeal_id", true);
  const decision = interaction.options.getString("decision", true) as
    | "approved"
    | "denied";
  const reviewReason = interaction.options.getString("review_reason");
  const resolvedReason =
    reviewReason?.trim() ||
    `Resolved by /appeal-admin review (${decision})`;

  const resolved = context.databases.moderationDb.ResolveAppeal({
    id: appealId,
    status: decision,
    resolved_by: interaction.user.id,
    resolved_reason: resolvedReason,
  });

  if (!resolved) {
    const embed = EmbedFactory.CreateWarning({
      title: "Appeal Not Open",
      description: "Appeal not found or it has already been resolved.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
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
    flags: MessageFlags.Ephemeral,
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
    context.logger.Warn("Appeal review channel unavailable for update", {
      extra: {
        guildId: interaction.guild.id,
        appealId: resolved.id,
        reviewChannelId: resolved.review_channel_id,
      },
    });
    return;
  }

  const message = await channel.messages
    .fetch(resolved.review_message_id)
    .catch(() => null);
  if (!message) {
    context.logger.Warn("Appeal review message unavailable for update", {
      extra: {
        guildId: interaction.guild.id,
        appealId: resolved.id,
        reviewChannelId: resolved.review_channel_id,
        reviewMessageId: resolved.review_message_id,
      },
    });
    return;
  }

  const reviewEmbed = BuildResolvedReviewEmbed({
    appeal: resolved,
    decision,
    reviewerId: interaction.user.id,
    removalDetail,
  });

  try {
    await message.edit({ embeds: [reviewEmbed.toJSON()], components: [] });
  } catch (error) {
    context.logger.Warn("Failed to update appeal review message", {
      error,
      extra: {
        guildId: interaction.guild.id,
        appealId: resolved.id,
        reviewChannelId: resolved.review_channel_id,
        reviewMessageId: resolved.review_message_id,
      },
    });
  }

  await PostResolvedChannelMessage(
    context,
    channel,
    resolved,
    decision,
    removalDetail
  );
}
