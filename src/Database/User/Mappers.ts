import { isStringArray, SafeParseJson } from "@utilities/SafeJson";
import { Balance, Note, UserXp, Warning } from "@database/User/Types";

export function MapNote(row: Record<string, unknown>): Note {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    guild_id: String(row.guild_id),
    moderator_id: String(row.moderator_id),
    content: String(row.content),
    created_at: Number(row.created_at),
  };
}

export function MapWarning(row: Record<string, unknown>): Warning {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    guild_id: String(row.guild_id),
    moderator_id: String(row.moderator_id),
    reason: row.reason ? String(row.reason) : null,
    created_at: Number(row.created_at),
  };
}

export function MapBalance(row: Record<string, unknown>): Balance {
  return {
    user_id: String(row.user_id),
    guild_id: String(row.guild_id),
    balance: Number(row.balance),
    updated_at: Number(row.updated_at),
  };
}

export function MapUserXp(row: Record<string, unknown>): UserXp {
  return {
    user_id: String(row.user_id),
    guild_id: String(row.guild_id),
    xp: Number(row.xp),
    level: Number(row.level),
    total_xp_earned: Number(row.total_xp_earned),
    updated_at: Number(row.updated_at),
  };
}

export function ParseWinners(winners: string | null): string[] | null {
  if (!winners) return null;
  const result = SafeParseJson(winners, isStringArray);
  return result.success && result.data ? result.data : null;
}

export function CalculateXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}
