import type { ServerDatabase } from "@database/ServerDatabase";

export type GuildFeatureKey = "economy" | "giveaways";

export function IsEconomyEnabled(
  serverDb: ServerDatabase,
  guildId: string,
): boolean {
  const settings = serverDb.GetGuildSettings(guildId);
  if (!settings) {
    return true;
  }
  return settings.economy_enabled;
}

export function IsGiveawaysEnabled(
  serverDb: ServerDatabase,
  guildId: string,
): boolean {
  const settings = serverDb.GetGuildSettings(guildId);
  if (!settings) {
    return true;
  }
  return settings.giveaways_enabled;
}

export function IsGuildFeatureEnabled(
  serverDb: ServerDatabase,
  guildId: string,
  feature: GuildFeatureKey,
): boolean {
  if (feature === "economy") {
    return IsEconomyEnabled(serverDb, guildId);
  }
  return IsGiveawaysEnabled(serverDb, guildId);
}
