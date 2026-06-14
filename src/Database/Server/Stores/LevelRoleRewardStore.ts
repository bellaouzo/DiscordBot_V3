import type Database from "better-sqlite3";

export interface LevelRoleReward {
  guild_id: string;
  level: number;
  role_id: string;
}

type LevelRoleRewardRow = {
  guild_id: string;
  level: number;
  role_id: string;
};

function MapLevelRoleReward(row: LevelRoleRewardRow): LevelRoleReward {
  return {
    guild_id: row.guild_id,
    level: Number(row.level),
    role_id: row.role_id,
  };
}

export class LevelRoleRewardStore {
  constructor(private readonly db: Database.Database) {}

  GetLevelRoleRewards(guild_id: string): LevelRoleReward[] {
    const rows = this.db
      .prepare(
        "SELECT guild_id, level, role_id FROM level_role_rewards WHERE guild_id = ? ORDER BY level ASC",
      )
      .all(guild_id) as LevelRoleRewardRow[];

    return rows.map(MapLevelRoleReward);
  }

  GetLevelRoleReward(guild_id: string, level: number): LevelRoleReward | null {
    const row = this.db
      .prepare(
        "SELECT guild_id, level, role_id FROM level_role_rewards WHERE guild_id = ? AND level = ?",
      )
      .get(guild_id, level) as LevelRoleRewardRow | undefined;

    return row ? MapLevelRoleReward(row) : null;
  }

  UpsertLevelRoleReward(data: {
    guild_id: string;
    level: number;
    role_id: string;
  }): LevelRoleReward {
    this.db
      .prepare(
        `
        INSERT INTO level_role_rewards (guild_id, level, role_id)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
      `,
      )
      .run(data.guild_id, data.level, data.role_id);

    const saved = this.GetLevelRoleReward(data.guild_id, data.level);
    if (!saved) {
      throw new Error("Failed to save level role reward");
    }

    return saved;
  }

  RemoveLevelRoleReward(guild_id: string, level: number): boolean {
    const result = this.db
      .prepare(
        "DELETE FROM level_role_rewards WHERE guild_id = ? AND level = ?",
      )
      .run(guild_id, level);

    return result.changes > 0;
  }
}
