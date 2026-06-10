import type { Appeal } from "@database";
import { EmbedFactory } from "@utilities";
import type { PaginationPage } from "@shared/Paginator";

export const APPEAL_LIST_PAGE_SIZE = 10;

export function BuildAppealListPages(appeals: Appeal[]): PaginationPage[] {
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
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

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
    embed.addFields([
      { name: "Evidence", value: data.appeal.evidence, inline: false },
    ]);
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
