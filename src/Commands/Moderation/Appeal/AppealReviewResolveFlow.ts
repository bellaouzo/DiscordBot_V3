import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CommandContext } from "@commands";
import { AppealStatus } from "@database";
import { ResolveInteractionMember } from "@utilities";
import {
  IsAppealReviewer,
  NotifyAppealUser,
  PostResolvedChannelMessage,
  RemoveAppealedAction,
} from "@commands/Moderation/Appeal/AppealShared";
import { BuildResolvedReviewEmbed } from "@commands/Moderation/Appeal/AppealFormatters";

const APPEAL_REVIEW_MODAL_TIMEOUT_MS = 1000 * 60 * 5;

async function FinalizeAppealDecision(data: {
  context: CommandContext;
  appealId: number;
  status: Exclude<AppealStatus, "open">;
  reviewerId: string;
  resolvedReason: string;
  guildId: string;
  client: ButtonInteraction["client"];
}): Promise<boolean> {
  const {
    context,
    appealId,
    status,
    reviewerId,
    resolvedReason,
    guildId,
    client,
  } = data;

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
        await message
          .edit({ embeds: [updatedEmbed.toJSON()], components: [] })
          .catch(() => {});
      }
      await PostResolvedChannelMessage(
        context,
        channel,
        resolved,
        status,
        removalDetail,
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
  status: Exclude<AppealStatus, "open">,
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
  const member = await ResolveInteractionMember(interaction);
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
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
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
