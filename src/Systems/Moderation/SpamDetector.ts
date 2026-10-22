import type { SpamFilterSettings } from "@database/Moderation/Types";

/** Identical messages are compared within this window. */
export const SPAM_DUPLICATE_WINDOW_MS = 30_000;
/** After a violation, further messages are removed without new strikes for this long. */
export const SPAM_SUPPRESS_MS = 10_000;
const PRUNE_EVERY_RECORDS = 500;

export type SpamReason = "flood" | "duplicate" | "mentions";

export interface SpamMessageRef {
  readonly channelId: string;
  readonly messageId: string;
}

export interface TrackedSpamMessage {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly content: string;
  readonly mentionCount: number;
  readonly at: number;
}

export type SpamDetectorThresholds = Pick<
  SpamFilterSettings,
  | "max_messages"
  | "window_seconds"
  | "duplicate_threshold"
  | "mention_threshold"
>;

export type SpamCheckResult =
  | { readonly kind: "clean" }
  /** Part of a burst that was already punished: remove it, but don't add a strike. */
  | { readonly kind: "suppressed"; readonly message: SpamMessageRef }
  | {
      readonly kind: "violation";
      readonly reason: SpamReason;
      readonly description: string;
      /** Every tracked message that belongs to the violation, including this one. */
      readonly messages: readonly SpamMessageRef[];
    };

interface UserHistory {
  entries: Array<SpamMessageRef & { content: string; at: number }>;
  suppressUntil: number;
}

function NormalizeContent(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Tracks recent messages per member in memory and decides when they count as spam.
 * State is lost on restart, which only means a fresh window; strikes are persisted elsewhere.
 */
export class SpamDetector {
  private readonly histories = new Map<string, UserHistory>();
  private recordsSincePrune = 0;

  Check(
    message: TrackedSpamMessage,
    thresholds: SpamDetectorThresholds,
  ): SpamCheckResult {
    this.MaybePrune(message.at);

    const key = `${message.guildId}:${message.userId}`;
    const history = this.histories.get(key) ?? {
      entries: [],
      suppressUntil: 0,
    };
    this.histories.set(key, history);

    const ref: SpamMessageRef = {
      channelId: message.channelId,
      messageId: message.messageId,
    };

    if (message.at < history.suppressUntil) {
      return { kind: "suppressed", message: ref };
    }

    const content = NormalizeContent(message.content);
    const floodWindowMs = thresholds.window_seconds * 1000;
    const retentionMs = Math.max(floodWindowMs, SPAM_DUPLICATE_WINDOW_MS);
    history.entries = history.entries.filter(
      (entry) => message.at - entry.at < retentionMs,
    );
    history.entries.push({ ...ref, content, at: message.at });

    const violation = this.FindViolation(message, history, thresholds);
    if (!violation) {
      return { kind: "clean" };
    }

    history.entries = [];
    history.suppressUntil = message.at + SPAM_SUPPRESS_MS;
    return { kind: "violation", ...violation };
  }

  /** Forgets a member's recent messages and any active suppression (e.g. after strikes are reset). */
  Reset(guildId: string, userId: string): void {
    this.histories.delete(`${guildId}:${userId}`);
  }

  private FindViolation(
    message: TrackedSpamMessage,
    history: UserHistory,
    thresholds: SpamDetectorThresholds,
  ): Omit<Extract<SpamCheckResult, { kind: "violation" }>, "kind"> | null {
    const current = history.entries[history.entries.length - 1];

    if (message.mentionCount >= thresholds.mention_threshold) {
      return {
        reason: "mentions",
        description: `Mentioned ${message.mentionCount} users or roles in one message`,
        messages: [current],
      };
    }

    const floodWindowMs = thresholds.window_seconds * 1000;
    const inFloodWindow = history.entries.filter(
      (entry) => message.at - entry.at < floodWindowMs,
    );
    if (inFloodWindow.length > thresholds.max_messages) {
      return {
        reason: "flood",
        description: `Sent ${inFloodWindow.length} messages in ${thresholds.window_seconds} seconds`,
        messages: inFloodWindow,
      };
    }

    if (current.content.length > 0) {
      const duplicates = history.entries.filter(
        (entry) =>
          entry.content === current.content &&
          message.at - entry.at < SPAM_DUPLICATE_WINDOW_MS,
      );
      if (duplicates.length >= thresholds.duplicate_threshold) {
        return {
          reason: "duplicate",
          description: `Repeated the same message ${duplicates.length} times`,
          messages: duplicates,
        };
      }
    }

    return null;
  }

  private MaybePrune(now: number): void {
    this.recordsSincePrune += 1;
    if (this.recordsSincePrune < PRUNE_EVERY_RECORDS) {
      return;
    }
    this.recordsSincePrune = 0;
    for (const [key, history] of this.histories) {
      const last = history.entries[history.entries.length - 1];
      const idleSince = Math.max(last?.at ?? 0, history.suppressUntil);
      if (now - idleSince > SPAM_DUPLICATE_WINDOW_MS * 2) {
        this.histories.delete(key);
      }
    }
  }
}

/** The detector the message handler uses; shared so `/spamfilter reset` can clear it. */
export const SharedSpamDetector = new SpamDetector();
