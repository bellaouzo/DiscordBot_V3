import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "@middleware";
import { GetFeature, IsFeatureEnabled } from "@shared/Features";
import { EmbedFactory } from "@utilities";

export const FeatureEnabledMiddleware: CommandMiddleware = {
  name: "feature-enabled",
  execute: async (context, next) => {
    const guild = context.interaction.guild;
    const requiredFeature = context.config.feature;

    if (!guild || !requiredFeature) {
      await next();
      return;
    }

    const enabled = IsFeatureEnabled(
      context.databases.serverDb,
      guild.id,
      requiredFeature,
    );

    if (enabled) {
      await next();
      return;
    }

    const featureLabel = GetFeature(requiredFeature).name;

    const embed = EmbedFactory.CreateWarning({
      title: `${featureLabel} Disabled`,
      description: `This feature is disabled for this server. An admin can enable it in \`/setup\`.`,
    });

    await context.responders.interactionResponder.Reply(context.interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
