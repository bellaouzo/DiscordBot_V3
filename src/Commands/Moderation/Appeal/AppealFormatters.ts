import { Appeal } from "@database";
import { EmbedFactory } from "@utilities";

export function BuildAppealReviewEmbed(data: {
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

export function BuildResolvedReviewEmbed(data: {
  appeal: Appeal;
  decision: "approved" | "denied";
  reviewerId: string;
  removalDetail?: string;
}) {
  const embed = EmbedFactory.Create({
    title: `Appeal #${data.appeal.id} — ${data.appeal.action_type.toUpperCase()}`,
    description: `Appeal has been **${data.decision.toUpperCase()}**.`,
  });
  embed.addFields([
    { name: "User", value: `<@${data.appeal.user_id}>`, inline: true },
    { name: "Resolved By", value: `<@${data.reviewerId}>`, inline: true },
    {
      name: "Resolved At",
      value: `<t:${Math.floor((data.appeal.resolved_at ?? Date.now()) / 1000)}:f>`,
      inline: true,
    },
  ]);

  if (data.appeal.resolved_reason) {
    embed.addFields([
      {
        name: "Resolution Reason",
        value: data.appeal.resolved_reason,
        inline: false,
      },
    ]);
  }

  if (data.decision === "approved" && data.removalDetail) {
    embed.addFields([
      {
        name: "Action Update",
        value: data.removalDetail,
        inline: false,
      },
    ]);
  }

  return embed;
}
