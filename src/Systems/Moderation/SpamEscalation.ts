import type { SpamStrikeAction } from "@database/Moderation/Types";

export interface SpamPunishment {
  readonly action: SpamStrikeAction;
  readonly durationMs: number | null;
  readonly label: string;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Punishment for the 1st, 2nd, 3rd... active strike. The last step repeats. */
export const SPAM_ESCALATION_LADDER: readonly SpamPunishment[] = [
  { action: "warn", durationMs: null, label: "Warning" },
  { action: "timeout", durationMs: 10 * MINUTE_MS, label: "10 minute timeout" },
  { action: "timeout", durationMs: HOUR_MS, label: "1 hour timeout" },
  { action: "timeout", durationMs: 24 * HOUR_MS, label: "24 hour timeout" },
];

/** @param strikeNumber - 1-based count of active strikes, including the new one. */
export function ResolveSpamPunishment(strikeNumber: number): SpamPunishment {
  const index = Math.min(
    Math.max(strikeNumber, 1) - 1,
    SPAM_ESCALATION_LADDER.length - 1,
  );
  return SPAM_ESCALATION_LADDER[index];
}

export function DescribeSpamLadder(): string {
  return SPAM_ESCALATION_LADDER.map((step, index) => {
    const isLast = index === SPAM_ESCALATION_LADDER.length - 1;
    return `**${index + 1}${isLast ? "+" : ""}.** ${step.label}`;
  }).join("\n");
}
