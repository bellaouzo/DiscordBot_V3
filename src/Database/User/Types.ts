export interface Warning {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  reason: string | null;
  created_at: number;
}

export interface Note {
  id: number;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  content: string;
  created_at: number;
}

export interface Balance {
  user_id: string;
  guild_id: string;
  balance: number;
  updated_at: number;
}

export interface UserXp {
  user_id: string;
  guild_id: string;
  xp: number;
  level: number;
  total_xp_earned: number;
  updated_at: number;
}

export interface Giveaway {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string;
  prize: string;
  winner_count: number;
  ends_at: number;
  ended: boolean;
  winners: string[] | null;
  created_at: number;
}

export interface GiveawayEntry {
  giveaway_id: number;
  user_id: string;
  entered_at: number;
}
