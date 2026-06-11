import type { Guild, GuildMember } from "discord.js";
import type { ServerDatabase } from "@database/ServerDatabase";
import type { Logger } from "@shared/Logger";
import { ValidateAssignableRole } from "@utilities";

export function ResolveLevelsToReward(
  previousLevel: number,
  newLevel: number,
): number[] {
  const levels: number[] = [];
  for (let level = previousLevel + 1; level <= newLevel; level += 1) {
    levels.push(level);
  }
  return levels;
}

export async function ApplyLevelRoleRewards(options: {
  member: GuildMember;
  guild: Guild;
  previousLevel: number;
  newLevel: number;
  serverDb: ServerDatabase;
  logger: Logger;
}): Promise<void> {
  const { member, guild, previousLevel, newLevel, serverDb, logger } = options;
  const levels = ResolveLevelsToReward(previousLevel, newLevel);

  for (const level of levels) {
    const reward = serverDb.GetLevelRoleReward(guild.id, level);
    if (!reward) {
      continue;
    }

    if (member.roles.cache.has(reward.role_id)) {
      continue;
    }

    try {
      const role = await guild.roles.fetch(reward.role_id);
      const validation = ValidateAssignableRole(guild, role);

      if (!validation.valid) {
        logger.Warn("Skipping invalid level role reward", {
          guildId: guild.id,
          userId: member.id,
          extra: { level, roleId: reward.role_id, reason: validation.reason },
        });
        continue;
      }

      await member.roles.add(reward.role_id, `Level ${level} reward`);
    } catch (error) {
      logger.Warn("Failed to assign level role reward", {
        guildId: guild.id,
        userId: member.id,
        error,
        extra: { level, roleId: reward.role_id },
      });
    }
  }
}
