import type { Guild } from "discord.js";
import { Routes } from "discord.js";
import {
  MembershipScreeningFieldType,
  type APIGuildMembershipScreening,
} from "discord-api-types/v10";
import type { Logger } from "@shared/Logger";

export interface GuildServerRules {
  readonly description: string | null;
  readonly rules: string[];
}

export async function FetchGuildServerRules(options: {
  guild: Guild;
  logger: Logger;
}): Promise<GuildServerRules | null> {
  const { guild, logger } = options;

  try {
    const screening = (await guild.client.rest.get(
      Routes.guildMemberVerification(guild.id),
    )) as APIGuildMembershipScreening;

    const rules: string[] = [];

    for (const field of screening.form_fields ?? []) {
      if (
        field.field_type === MembershipScreeningFieldType.Terms &&
        Array.isArray(field.values)
      ) {
        for (const value of field.values) {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            rules.push(trimmed);
          }
        }
      }
    }

    if (rules.length === 0) {
      return null;
    }

    return {
      description: screening.description?.trim() || null,
      rules,
    };
  } catch (error) {
    logger.Warn("Could not fetch Discord server rules for setup", {
      error,
      extra: { guildId: guild.id },
    });
    return null;
  }
}
