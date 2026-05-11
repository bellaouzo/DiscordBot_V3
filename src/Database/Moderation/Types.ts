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
