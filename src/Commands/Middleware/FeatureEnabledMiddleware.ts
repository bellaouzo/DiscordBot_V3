import { MessageFlags } from "discord.js";
import type { CommandMiddleware } from "@middleware";
import { IsGuildFeatureEnabled } from "@shared/GuildFeatures";
import type { GuildFeatureKey } from "@shared/GuildFeatures";
import { EmbedFactory } from "@utilities";

export const FeatureEnabledMiddleware: CommandMiddleware = {
  name: "feature-enabled",
  execute: async (context, next) => {
    const guild = context.interaction.guild;
    const requiredFeature = context.config?.requiredFeature;

    if (!guild || !requiredFeature) {
      await next();
      return;
    }

    const enabled = IsGuildFeatureEnabled(
      context.databases.serverDb,
      guild.id,
      requiredFeature,
    );

    if (enabled) {
      await next();
      return;
    }

    const featureLabel =
      requiredFeature === "economy" ? "Economy" : "Giveaways";

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

export type { GuildFeatureKey };
