import type { APIEmbed } from "discord.js";
import { EmbedFactory, FEATURE_GUIDES } from "@utilities";
import type { FeatureGuide } from "@utilities/FeatureGuides";
import type { CategoryView } from "@commands/Utility/Help/HelpTypes";
import { ChunkArray } from "@commands/Utility/Help/HelpCatalog";

const FEATURES_PER_PAGE = 2;

export function BuildFeatureCategoryView(): CategoryView {
  const pages = CreateFeaturePages();

  return {
    key: "features",
    name: "Server Features",
    description: "📖 Explanations for automated server systems",
    icon: "📖",
    commands: FEATURE_GUIDES.map((guide) => ({
      name: guide.command.replace("/", ""),
      description: guide.summary,
      group: "features",
    })),
    pages,
  };
}

export function FormatFeatureGuideFieldValue(guide: FeatureGuide): string {
  const commandHint =
    guide.key === "setup"
      ? `\`${guide.command}\``
      : `\`${guide.command} about\``;

  return [
    guide.summary,
    "",
    "**Setup**",
    guide.setup,
    "**Learn more**",
    commandHint,
  ].join("\n");
}

function CreateFeaturePages(): APIEmbed[] {
  const chunks = ChunkArray([...FEATURE_GUIDES], FEATURES_PER_PAGE);

  return chunks.map((chunk, index) => {
    const embed = EmbedFactory.Create({
      title: "📖 Server Features",
      ...(index === 0
        ? {
            description: [
              "Automated systems you can configure once and let the bot handle.",
              "Use each command's `about` subcommand anytime for full details.",
            ].join("\n"),
          }
        : {}),
      color: 0x5865f2,
      footer: `Page ${index + 1}/${chunks.length} • ${FEATURE_GUIDES.length} features`,
    });

    chunk.forEach((guide) => {
      embed.addFields({
        name: `${guide.icon} ${guide.name}`,
        value: FormatFeatureGuideFieldValue(guide),
        inline: false,
      });
    });

    return embed.toJSON();
  });
}
