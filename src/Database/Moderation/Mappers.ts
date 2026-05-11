import {
  Appeal,
  IsAppealActionType,
  IsAppealStatus,
  IsLinkFilterType,
  IsLockdownScope,
  IsTempActionType,
  LinkFilter,
  Lockdown,
  ModerationEvent,
  RaidMode,
  RaidModeChannelState,
  TempAction,
} from "@database/Moderation/Types";

export function MapTempAction(row: Record<string, unknown>): TempAction {
  const action = row.action;
  if (!IsTempActionType(action)) {
    throw new Error(`Invalid temp action type: ${action}`);
  }
  return {
    id: Number(row.id),
    action,
    guild_id: String(row.guild_id),
    user_id: String(row.user_id),
    moderator_id: String(row.moderator_id),
    reason: row.reason ? String(row.reason) : null,
    expires_at: Number(row.expires_at),
    processed: Boolean(row.processed),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export function MapLockdown(row: Record<string, unknown>): Lockdown {
  const scope = row.scope;
  if (!IsLockdownScope(scope)) {
    throw new Error(`Invalid lockdown scope: ${scope}`);
  }
  return {
    id: Number(row.id),
    scope,
    guild_id: String(row.guild_id),
    target_id: String(row.target_id),
    applied_by: String(row.applied_by),
    applied_at: Number(row.applied_at),
    lifted_at: row.lifted_at ? Number(row.lifted_at) : null,
    active: Boolean(row.active),
    overwrites: String(row.overwrites),
  };
}

export function MapLinkFilter(row: Record<string, unknown>): LinkFilter {
  const filterType = row.type;
  if (!IsLinkFilterType(filterType)) {
    throw new Error(`Invalid link filter type: ${filterType}`);
  }
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    pattern: String(row.pattern),
    type: filterType,
    created_by: String(row.created_by),
    created_at: Number(row.created_at),
  };
}

export function MapRaidMode(row: Record<string, unknown>): RaidMode {
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    slowmode_seconds: Number(row.slowmode_seconds),
    expires_at: row.expires_at ? Number(row.expires_at) : null,
    applied_by: String(row.applied_by),
    applied_at: Number(row.applied_at),
    cleared_at: row.cleared_at ? Number(row.cleared_at) : null,
    active: Boolean(row.active),
  };
}

export function MapRaidModeChannel(
  row: Record<string, unknown>
): RaidModeChannelState {
  return {
    id: Number(row.id),
    raid_id: Number(row.raid_id),
    guild_id: String(row.guild_id),
    channel_id: String(row.channel_id),
    overwrites: String(row.overwrites),
    rate_limit_per_user: Number(row.rate_limit_per_user),
  };
}

export function MapAppeal(row: Record<string, unknown>): Appeal {
  const actionType = row.action_type;
  const status = row.status;

  if (!IsAppealActionType(actionType)) {
    throw new Error(`Invalid appeal action type: ${actionType}`);
  }

  if (!IsAppealStatus(status)) {
    throw new Error(`Invalid appeal status: ${status}`);
  }

  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    user_id: String(row.user_id),
    action_type: actionType,
    action_ref: row.action_ref ? String(row.action_ref) : null,
    reason: String(row.reason),
    evidence: row.evidence ? String(row.evidence) : null,
    status,
    review_channel_id: row.review_channel_id ? String(row.review_channel_id) : null,
    review_message_id: row.review_message_id ? String(row.review_message_id) : null,
    resolved_by: row.resolved_by ? String(row.resolved_by) : null,
    resolved_reason: row.resolved_reason ? String(row.resolved_reason) : null,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    resolved_at:
      row.resolved_at === null || row.resolved_at === undefined
        ? null
        : Number(row.resolved_at),
  };
}

export function MapModerationEvent(row: Record<string, unknown>): ModerationEvent {
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    user_id: String(row.user_id),
    moderator_id: String(row.moderator_id),
    action: row.action as "kick" | "ban",
    reason: row.reason ? String(row.reason) : null,
    duration_ms:
      row.duration_ms === null || row.duration_ms === undefined
        ? null
        : Number(row.duration_ms),
    created_at: Number(row.created_at),
  };
}
