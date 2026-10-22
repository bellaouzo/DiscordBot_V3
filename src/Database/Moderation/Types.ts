export type TempActionType = "ban" | "mute";

export function IsTempActionType(value: unknown): value is TempActionType {
  return value === "ban" || value === "mute";
}

export interface TempAction {
  id: number;
  action: TempActionType;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string | null;
  expires_at: number;
  processed: boolean;
  created_at: number;
  updated_at: number;
}

export type LockdownScope = "channel" | "category";

export function IsLockdownScope(value: unknown): value is LockdownScope {
  return value === "channel" || value === "category";
}

export interface Lockdown {
  id: number;
  scope: LockdownScope;
  guild_id: string;
  target_id: string;
  applied_by: string;
  applied_at: number;
  lifted_at: number | null;
  active: boolean;
  overwrites: string;
}

export type LinkFilterType = "allow" | "block";

export function IsLinkFilterType(value: unknown): value is LinkFilterType {
  return value === "allow" || value === "block";
}

export interface LinkFilter {
  id: number;
  guild_id: string;
  pattern: string;
  type: LinkFilterType;
  created_by: string;
  created_at: number;
}

export interface ModerationEvent {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  action: "kick" | "ban";
  reason: string | null;
  duration_ms: number | null;
  created_at: number;
}

export interface RaidMode {
  id: number;
  guild_id: string;
  slowmode_seconds: number;
  expires_at: number | null;
  applied_by: string;
  applied_at: number;
  cleared_at: number | null;
  active: boolean;
}

export interface RaidModeChannelState {
  id: number;
  raid_id: number;
  guild_id: string;
  channel_id: string;
  overwrites: string;
  rate_limit_per_user: number;
}

export type AppealActionType = "warning" | "mute" | "ban" | "kick";

export function IsAppealActionType(value: unknown): value is AppealActionType {
  return (
    value === "warning" ||
    value === "mute" ||
    value === "ban" ||
    value === "kick"
  );
}

export type AppealStatus = "open" | "approved" | "denied";

export function IsAppealStatus(value: unknown): value is AppealStatus {
  return value === "open" || value === "approved" || value === "denied";
}

export interface Appeal {
  id: number;
  guild_id: string;
  user_id: string;
  action_type: AppealActionType;
  action_ref: string | null;
  reason: string;
  evidence: string | null;
  status: AppealStatus;
  review_channel_id: string | null;
  review_message_id: string | null;
  resolved_by: string | null;
  resolved_reason: string | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
}

export type SpamStrikeAction = "warn" | "timeout";

export function IsSpamStrikeAction(value: unknown): value is SpamStrikeAction {
  return value === "warn" || value === "timeout";
}

export interface SpamStrike {
  id: number;
  guild_id: string;
  user_id: string;
  reason: string;
  action: SpamStrikeAction;
  duration_ms: number | null;
  created_at: number;
}

export interface SpamFilterSettings {
  guild_id: string;
  /** Messages allowed per user within `window_seconds`. */
  max_messages: number;
  window_seconds: number;
  /** Identical messages within the duplicate window that count as spam. */
  duplicate_threshold: number;
  /** User and role mentions allowed in a single message. */
  mention_threshold: number;
  /** Strikes older than this no longer count toward escalation. */
  strike_decay_hours: number;
  exempt_channel_ids: string[];
}

export const SPAM_FILTER_DEFAULTS: Omit<SpamFilterSettings, "guild_id"> = {
  max_messages: 6,
  window_seconds: 5,
  duplicate_threshold: 3,
  mention_threshold: 5,
  strike_decay_hours: 24,
  exempt_channel_ids: [],
};
