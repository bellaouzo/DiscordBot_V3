import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  EmbedFactory,
  GetFeatureGuide,
  BuildFeatureGuideEmbed,
} from "@utilities";

export async function ReplyWithFeatureAbout(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  featureKey: string,
): Promise<void> {
  const guide = GetFeatureGuide(featureKey);

  if (!guide) {
    const embed = EmbedFactory.CreateError({
      title: "Guide Not Found",
      description: "No feature guide is available for this command.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [BuildFeatureGuideEmbed(guide).toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}
