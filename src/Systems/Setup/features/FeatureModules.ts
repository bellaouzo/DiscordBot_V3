import type { GuildSettings } from "@database/ServerDatabase";
import type { GuildXpSettings } from "@database/Server/Types";
import type { SetupDraft } from "../state";

export type FeatureModuleId =
  | "economy"
  | "leveling"
  | "starboard"
  | "verification"
  | "giveaways";

export interface FeatureModuleDefinition {
  readonly id: FeatureModuleId;
  readonly label: string;
  readonly description: string;
  readonly emoji: string;
}

export const FEATURE_MODULES: readonly FeatureModuleDefinition[] = [
  {
    id: "economy",
    label: "Economy",
    description: "Coins, games, market, and lotteries",
    emoji: "🪙",
  },
  {
    id: "leveling",
    label: "Leveling",
    description: "Chat XP, ranks, and level rewards",
    emoji: "📈",
  },
  {
    id: "starboard",
    label: "Starboard",
    description: "Highlight popular messages",
    emoji: "⭐",
  },
  {
    id: "verification",
    label: "Verification",
    description: "Gate access until members verify",
    emoji: "✅",
  },
  {
    id: "giveaways",
    label: "Giveaways",
    description: "Run timed giveaways with entry buttons",
    emoji: "🎁",
  },
];

export function ReadFeatureEnabled(
  moduleId: FeatureModuleId,
  settings: GuildSettings,
  xpSettings: GuildXpSettings,
): boolean {
  switch (moduleId) {
    case "economy":
      return settings.economy_enabled;
    case "leveling":
      return xpSettings.enabled;
    case "starboard":
      return settings.starboard_channel_id !== null;
    case "verification":
      return settings.verification_enabled;
    case "giveaways":
      return settings.giveaways_enabled;
  }
}

export function FormatFeatureStatus(enabled: boolean): string {
  return enabled ? "**On**" : "**Off**";
}

export function FormatFeatureToggleLabel(
  module: FeatureModuleDefinition,
  enabled: boolean,
): string {
  return `${module.label} · ${enabled ? "On" : "Off"}`;
}

const DRAFT_FEATURE_KEYS: Record<
  FeatureModuleId,
  keyof Pick<
    SetupDraft,
    | "economyEnabled"
    | "levelingEnabled"
    | "starboardEnabled"
    | "verificationEnabled"
    | "giveawaysEnabled"
  >
> = {
  economy: "economyEnabled",
  leveling: "levelingEnabled",
  starboard: "starboardEnabled",
  verification: "verificationEnabled",
  giveaways: "giveawaysEnabled",
};

export function GetDraftFeatureEnabled(
  draft: SetupDraft,
  moduleId: FeatureModuleId,
): boolean {
  return draft[DRAFT_FEATURE_KEYS[moduleId]];
}

export function SetDraftFeatureEnabled(
  draft: SetupDraft,
  moduleId: FeatureModuleId,
  enabled: boolean,
): void {
  draft[DRAFT_FEATURE_KEYS[moduleId]] = enabled;
}
