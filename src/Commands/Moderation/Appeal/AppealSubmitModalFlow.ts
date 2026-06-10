import {
  ButtonStyle,
  ChannelType,
  Guild,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { CommandContext } from "@commands";
import { Appeal } from "@database";
import {
  AppealableActionOption,
  ComponentFactory,
  CreateAppealManager,
  CreateChannelManager,
  EmbedFactory,
} from "@utilities";
import { BuildAppealReviewEmbed } from "@commands/Moderation/Appeal/AppealFormatters";
import { HandleAppealDecisionButton } from "@commands/Moderation/Appeal/AppealReviewResolveFlow";

async function CreateAppealReviewChannel(data: {
  guild: Guild;
  requesterId: string;
  requesterUsername: string;
  context: CommandContext;
  appeal: Appeal;
  contextLine: string;
}): Promise<{ channel: TextChannel } | null> {
  const {
    guild,
    context,
    requesterId,
    requesterUsername,
    appeal,
    contextLine,
  } = data;
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const channelManager = CreateChannelManager({
    guild,
    logger: context.logger,
  });
  const fallbackCategory = await channelManager.GetOrCreateCategory("Appeals");

  let parentCategoryId =
    settings?.appeal_review_category_id ?? fallbackCategory?.id ?? null;
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

export async function ProcessAppealSubmission(data: {
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
          description:
            validation.message ?? "Could not validate selected action.",
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
