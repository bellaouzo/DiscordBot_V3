import { EmbedFactory } from "@utilities/EmbedFactory";
import { FEATURES } from "@shared/Features";
import type { FeatureKey } from "@shared/Features";

export type FeatureGuide = {
  readonly key: FeatureKey;
  readonly name: string;
  readonly icon: string;
  readonly summary: string;
  readonly howItWorks: string;
  readonly setup: string;
  readonly command: string;
};

/** Help-facing view of every feature that has a guide. Edit guides in @shared/Features. */
export const FEATURE_GUIDES: readonly FeatureGuide[] = FEATURES.flatMap(
  (feature) =>
    feature.guide
      ? [
          {
            key: feature.key as FeatureKey,
            name: feature.name,
            icon: feature.icon,
            summary: feature.summary,
            ...feature.guide,
          },
        ]
      : [],
);

export function GetFeatureGuide(key: string): FeatureGuide | null {
  return FEATURE_GUIDES.find((guide) => guide.key === key) ?? null;
}

export function BuildFeatureGuideEmbed(guide: FeatureGuide) {
  const embed = EmbedFactory.Create({
    title: `${guide.icon} ${guide.name}`,
    description: guide.summary,
    color: 0x5865f2,
  });

  embed.addFields(
    {
      name: "How it works",
      value: guide.howItWorks,
      inline: false,
    },
    {
      name: "Quick setup",
      value: guide.setup,
      inline: false,
    },
  );

  embed.setFooter({
    text: `Configure with ${guide.command}`,
  });

  return embed;
}

export function AppendFeatureGuideHint(
  embed: ReturnType<typeof EmbedFactory.Create>,
  featureKey: string,
): void {
  const guide = GetFeatureGuide(featureKey);
  if (!guide) {
    return;
  }

  embed.addFields({
    name: "What is this?",
    value: `${guide.summary}\nRun \`${guide.command} about\` for full details.`,
    inline: false,
  });
}
