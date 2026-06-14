import type { ServerDatabase } from "@database/ServerDatabase";
import type { GuildSettings } from "@database/Server/Types";
import type { SetupDraft } from "../state";
import { BuildDraftFromSettings } from "../state";

export function SyncDraftFromSavedSettings(
  draft: SetupDraft,
  guildSettings: GuildSettings,
  serverDb: ServerDatabase,
  guildId: string,
): void {
  const xpSettings = serverDb.GetGuildXpSettings(guildId);
  const synced = BuildDraftFromSettings(guildSettings, xpSettings);
  Object.assign(draft, synced);
}
