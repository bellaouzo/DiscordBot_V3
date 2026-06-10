import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands";
import {
  CreateAppealManager,
  EmbedFactory,
  ResolveInteractionMember,
} from "@utilities";
import {
  IsAppealReviewer,
  NotifyAppealUser,
  PostResolvedChannelMessage,
  RemoveAppealedAction,
} from "@commands/Moderation/Appeal/AppealShared";
import {
  APPEAL_LIST_PAGE_SIZE,
  BuildAppealListPages,
  BuildResolvedReviewEmbed,
} from "@commands/Moderation/Appeal/AppealFormatters";

export async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
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

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);
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
  context: CommandContext,
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

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);
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
    reviewReason?.trim() || `Resolved by /appeal-admin review (${decision})`;

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
    const removal = await RemoveAppealedAction(
      interaction.guild,
      context,
      resolved,
    );
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
      {
        name: "Resolution Reason",
        value: resolved.resolved_reason,
        inline: false,
      },
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
    removalDetail,
  );
}
