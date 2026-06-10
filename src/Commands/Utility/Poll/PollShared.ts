import type { Message, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { EmbedFactory } from "@utilities";
import type { PaginationPage } from "@shared/Paginator";

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 10080;
export const LIST_FETCH_LIMIT = 50;
export const LIST_PAGE_SIZE = 6;

export interface NativePollResults {
  isFinalized?: boolean;
  finalized?: boolean;
}

export interface NativePoll {
  question?: { text?: string };
  answers?: Array<{ text?: string }>;
  allowMultiselect?: boolean;
  duration?: number | null;
  expiresTimestamp?: number | null;
  expiresAt?: Date | null;
  results?: NativePollResults;
  resultsFinalized?: boolean;
  end?: () => Promise<void>;
  terminate?: () => Promise<void>;
  isFinalized?: boolean;
  ended?: boolean;
}

export function IsGuildTextChannel(channel: unknown): channel is TextChannel {
  return (
    Boolean(channel) && (channel as TextChannel).type === ChannelType.GuildText
  );
}

export function ExtractPoll(message: unknown): NativePoll | undefined {
  return (message as { poll?: NativePoll }).poll;
}

export function GetPollStatus(
  poll: NativePoll | undefined,
  createdTimestamp: number,
): { isEnded: boolean; endsAt?: number } {
  const endsAt = (() => {
    if (typeof poll?.expiresTimestamp === "number") {
      return poll.expiresTimestamp;
    }
    if (poll?.expiresAt instanceof Date) {
      return poll.expiresAt.getTime();
    }
    if (typeof poll?.duration === "number") {
      return createdTimestamp + poll.duration * 60 * 1000;
    }
    return undefined;
  })();

  const finalized =
    poll?.resultsFinalized ||
    poll?.results?.isFinalized ||
    poll?.results?.finalized ||
    poll?.isFinalized ||
    poll?.ended;

  const isEnded = Boolean(finalized || (endsAt ? Date.now() >= endsAt : false));

  return { isEnded, endsAt };
}

export function BuildPollPages(
  polls: Array<Message<true>>,
  channel: TextChannel,
): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < polls.length; index += LIST_PAGE_SIZE) {
    const slice = polls.slice(index, index + LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: `Polls in #${channel.name}`,
      description: `Showing polls ${start} - ${end} of ${polls.length}`,
    });

    slice.forEach((pollMessage, sliceIndex) => {
      const poll = ExtractPoll(pollMessage);
      const question = poll?.question?.text ?? "Untitled poll";
      const { isEnded, endsAt } = GetPollStatus(
        poll,
        pollMessage.createdTimestamp,
      );
      const status = isEnded ? "Ended" : "Active";
      const endText = endsAt
        ? isEnded
          ? ` — ended <t:${Math.floor(endsAt / 1000)}:R>`
          : ` — ends <t:${Math.floor(endsAt / 1000)}:R>`
        : "";

      embed.addFields({
        name: `${start + sliceIndex}. ${question}`,
        value: `${status}${endText}\nMessage ID: ${pollMessage.id}\n[Jump to poll](${pollMessage.url})`,
        inline: false,
      });
    });

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}
