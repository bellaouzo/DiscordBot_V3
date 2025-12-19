import type { UserXp } from "@database";

export interface UserLevel {
  userId: string;
  guildId: string;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  progressPercent: number;
}

export interface LevelUpResult {
  userXp: UserXp;
  leveledUp: boolean;
  previousLevel: number;
  xpGained: number;
}

export interface LeaderboardEntry {
  userId: string;
  level: number;
  xp: number;
  totalXpEarned: number;
  rank: number;
}

export interface XpAwardResult {
  xpGained: number;
  leveledUp: boolean;
  newLevel?: number;
  previousLevel?: number;
}
