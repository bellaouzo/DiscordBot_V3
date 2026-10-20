import type { Migration } from "@database/Migrations/types";

// Baseline schema, frozen. Idempotent so it is a no-op on databases created before
// migrations owned the schema. Never edit it: add a new migration version instead.
const USER_INITIAL_SCHEMA = `
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_warnings_user_guild ON warnings(user_id, guild_id);
    CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id);

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_guild ON notes(user_id, guild_id);
    CREATE INDEX IF NOT EXISTS idx_notes_guild ON notes(guild_id);

    CREATE TABLE IF NOT EXISTS balances (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      balance INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_balances_guild ON balances(guild_id);

    CREATE TABLE IF NOT EXISTS daily_claims (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      last_claim_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_claims_guild ON daily_claims(guild_id);

    CREATE TABLE IF NOT EXISTS inventories (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_inventories_guild ON inventories(guild_id);

    CREATE TABLE IF NOT EXISTS market_rotations (
      guild_id TEXT PRIMARY KEY,
      items TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      total_xp_earned INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_xp_guild ON user_xp(guild_id);
    CREATE INDEX IF NOT EXISTS idx_user_xp_level ON user_xp(guild_id, level DESC, xp DESC);

    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      host_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      winner_count INTEGER NOT NULL DEFAULT 1,
      ends_at INTEGER NOT NULL,
      ended INTEGER NOT NULL DEFAULT 0,
      winners TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);
    CREATE INDEX IF NOT EXISTS idx_giveaways_ends_at ON giveaways(ended, ends_at);

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      entered_at INTEGER NOT NULL,
      PRIMARY KEY (giveaway_id, user_id),
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_xp_daily (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      day_key INTEGER NOT NULL,
      earned INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, day_key)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_xp_daily_guild ON chat_xp_daily(guild_id);

    CREATE TABLE IF NOT EXISTS economy_duels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      challenger_id TEXT NOT NULL,
      opponent_id TEXT NOT NULL,
      bet INTEGER NOT NULL,
      game TEXT NOT NULL,
      status TEXT NOT NULL,
      winner_id TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_economy_duels_guild_status ON economy_duels(guild_id, status);

    CREATE TABLE IF NOT EXISTS economy_lotteries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      host_id TEXT NOT NULL,
      entry_cost INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      ended INTEGER NOT NULL DEFAULT 0,
      winner_id TEXT,
      pot INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_economy_lotteries_ends ON economy_lotteries(ended, ends_at);

    CREATE TABLE IF NOT EXISTS economy_lottery_entries (
      lottery_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (lottery_id, user_id),
      FOREIGN KEY (lottery_id) REFERENCES economy_lotteries(id) ON DELETE CASCADE
    );
`;

export const UserMigrations: readonly Migration[] = [
  {
    version: 0,
    name: "initial_schema",
    up(db) {
      db.exec(USER_INITIAL_SCHEMA);
    },
  },
];
