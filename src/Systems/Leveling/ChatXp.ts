import type { ServerDatabase, UserDatabase } from "@database";
import { LevelManager } from "@systems/Leveling/LevelManager";

export interface ChatXpAwardResult {
  awarded: number;
  leveledUp: boolean;
  newLevel?: number;
  previousLevel?: number;
}

const cooldownMap = new Map<string, number>();

function GetDayKey(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function GetCooldownKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function ResetChatXpCooldowns(): void {
  cooldownMap.clear();
}

export function AwardChatXp(options: {
  guildId: string;
  userId: string;
  channelId: string;
  messageContent: string;
  userDb: UserDatabase;
  serverDb: ServerDatabase;
}): ChatXpAwardResult {
  const settings = options.serverDb.GetGuildXpSettings(options.guildId);

  if (!settings.enabled) {
    return { awarded: 0, leveledUp: false };
  }

  if (settings.excluded_channel_ids.includes(options.channelId)) {
    return { awarded: 0, leveledUp: false };
  }

  const trimmed = options.messageContent.trim();
  if (trimmed.length < settings.min_message_length) {
    return { awarded: 0, leveledUp: false };
  }

  const cooldownKey = GetCooldownKey(options.guildId, options.userId);
  const now = Date.now();
  const lastAward = cooldownMap.get(cooldownKey) ?? 0;
  const cooldownMs = settings.cooldown_seconds * 1000;

  if (now - lastAward < cooldownMs) {
    return { awarded: 0, leveledUp: false };
  }

  const dayKey = GetDayKey();
  const earnedToday = options.userDb.GetChatXpDailyEarned(
    options.userId,
    options.guildId,
    dayKey,
  );

  if (earnedToday >= settings.daily_cap) {
    return { awarded: 0, leveledUp: false };
  }

  const remaining = settings.daily_cap - earnedToday;
  const toAward = Math.min(settings.xp_per_message, remaining);

  if (toAward <= 0) {
    return { awarded: 0, leveledUp: false };
  }

  const levelManager = new LevelManager(options.guildId, options.userDb);
  const result = levelManager.AddXp(options.userId, toAward);

  options.userDb.AddChatXpDailyEarned(
    options.userId,
    options.guildId,
    dayKey,
    toAward,
  );
  cooldownMap.set(cooldownKey, now);

  return {
    awarded: toAward,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    previousLevel: result.previousLevel,
  };
}
