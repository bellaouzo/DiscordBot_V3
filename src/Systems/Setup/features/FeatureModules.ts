import type { GuildSettings } from "@database/ServerDatabase";
import type { GuildXpSettings } from "@database/Server/Types";
import type { ToggleableFeatureKey } from "@shared/Features";
import {
  ReadFeatureEnabled as ReadRegisteredFeatureEnabled,
  TOGGLEABLE_FEATURES,
} from "@shared/Features";
import type { SetupDraft } from "../state";

export type FeatureModuleId = ToggleableFeatureKey;

export interface FeatureModuleDefinition {
  readonly id: FeatureModuleId;
  readonly label: string;
  readonly description: string;
  readonly emoji: string;
}

/** The /setup feature toggles, in display order. Defined in @shared/Features. */
export const FEATURE_MODULES: readonly FeatureModuleDefinition[] =
  TOGGLEABLE_FEATURES.map((feature) => ({
    id: feature.key,
    label: feature.toggle.label,
    description: feature.toggle.description,
    emoji: feature.toggle.emoji,
  }));

export function ReadFeatureEnabled(
  moduleId: FeatureModuleId,
  settings: GuildSettings,
  xpSettings: GuildXpSettings,
): boolean {
  return ReadRegisteredFeatureEnabled(moduleId, { settings, xpSettings });
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

export function GetDraftFeatureEnabled(
  draft: SetupDraft,
  moduleId: FeatureModuleId,
): boolean {
  return draft.features[moduleId];
}

export function SetDraftFeatureEnabled(
  draft: SetupDraft,
  moduleId: FeatureModuleId,
  enabled: boolean,
): void {
  draft.features[moduleId] = enabled;
}
