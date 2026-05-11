import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { CommandContext } from "@commands";
import { AppealStatus } from "@database";
import { EmbedFactory } from "@utilities";
import {
  IsAppealReviewer,
  NotifyAppealUser,
  PostApprovedChannelMessage,
  RemoveAppealedAction,
} from "@commands/Moderation/Appeal/AppealShared";
import { BuildResolvedReviewEmbed } from "@commands/Moderation/Appeal/AppealFormatters";

export async function HandleAppealDecisionButton(
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

  const updatedEmbed = BuildResolvedReviewEmbed({
    appeal: resolved,
    decision: status,
    reviewerId: interaction.user.id,
    removalDetail,
  });
  updatedEmbed.addFields([
    {
      name: "Reason",
      value: resolved.reason,
      inline: false,
    },
  ]);

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

  if (decision === "approved") {
    await PostApprovedChannelMessage(context, channel, resolved, removalDetail);
  }
}
