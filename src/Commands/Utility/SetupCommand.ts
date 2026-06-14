import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { RequireGuild, CreateChannelManager } from "@utilities";
import type { StepState } from "@systems/Setup/state";
import {
  CreateEmptySettings,
  SanitizeGuildSettings,
  CreateNavigationIds,
  BuildDraftFromSettings,
  ResolveExistingChannelId,
} from "@systems/Setup/state";
import { CollectResources } from "@systems/Setup/resources";
import { BuildSetupEmbed, BuildStepComponents } from "@systems/Setup/steps";
import { RegisterSelectHandlers } from "@systems/Setup/handlers/selectHandlers";
import { RegisterButtonHandlers } from "@systems/Setup/handlers/buttonHandlers";
import { RegisterFeatureToggleHandlers } from "@systems/Setup/handlers/featureToggleHandlers";
import type { SetupContext } from "@systems/Setup/steps/types";

async function ExecuteSetup(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const {
    interactionResponder,
    selectMenuRouter,
    componentRouter,
    buttonResponder,
  } = context.responders;
  const { logger, databases } = context;

  const guild = RequireGuild(interaction);
  const channelManager = CreateChannelManager({ guild, logger });
  const loggingDefaults = context.appConfig.logging;
  const currentSettings =
    databases.serverDb.GetGuildSettings(guild.id) ??
    CreateEmptySettings(guild.id);

  const sanitizedSettings = await SanitizeGuildSettings(guild, currentSettings);
  const xpSettings = databases.serverDb.GetGuildXpSettings(guild.id);
  const sanitizedLevelUpChannelId = await ResolveExistingChannelId(
    guild,
    xpSettings.level_up_channel_id,
    ChannelType.GuildText,
  );

  if (sanitizedLevelUpChannelId !== xpSettings.level_up_channel_id) {
    databases.serverDb.UpsertGuildXpSettings({
      guild_id: guild.id,
      level_up_channel_id: sanitizedLevelUpChannelId,
    });
  }

  const settingsChanged =
    JSON.stringify(sanitizedSettings) !== JSON.stringify(currentSettings);

  if (settingsChanged) {
    databases.serverDb.UpsertGuildSettings({
      guild_id: guild.id,
      admin_role_ids: sanitizedSettings.admin_role_ids,
      mod_role_ids: sanitizedSettings.mod_role_ids,
      ticket_category_id: sanitizedSettings.ticket_category_id,
      appeal_review_category_id: sanitizedSettings.appeal_review_category_id,
      command_log_channel_id: sanitizedSettings.command_log_channel_id,
      ticket_log_channel_id: sanitizedSettings.ticket_log_channel_id,
      announcement_channel_id: sanitizedSettings.announcement_channel_id,
      delete_log_channel_id: sanitizedSettings.delete_log_channel_id,
      production_log_channel_id: sanitizedSettings.production_log_channel_id,
      welcome_channel_id: sanitizedSettings.welcome_channel_id,
      starboard_channel_id: sanitizedSettings.starboard_channel_id,
      verification_channel_id: sanitizedSettings.verification_channel_id,
      unverified_role_id: sanitizedSettings.unverified_role_id,
      verified_role_id: sanitizedSettings.verified_role_id,
    });
  }

  const refreshedXpSettings = databases.serverDb.GetGuildXpSettings(guild.id);
  const draft = BuildDraftFromSettings(sanitizedSettings, refreshedXpSettings);
  const resources = CollectResources(guild);
  const ids = CreateNavigationIds(String(interaction.id));
  const stepState: StepState = { current: 1 };

  const setupContext: SetupContext = {
    guild,
    draft,
    resources,
    ids,
    stepState,
    loggingDefaults,
    channelManager,
    serverDb: databases.serverDb,
    ownerId: String(interaction.user.id),
    selectMenuRouter,
    componentRouter,
    buttonResponder,
    updateMessage: async () => {},
  };

  setupContext.updateMessage = async () => {
    await interaction.editReply({
      embeds: [BuildSetupEmbed(setupContext).toJSON()],
      components: BuildStepComponents(setupContext),
    });
  };

  RegisterSelectHandlers({
    interaction,
    draft,
    resources,
    ids,
    loggingDefaults,
    channelManager,
    selectMenuRouter,
    updateMessage: setupContext.updateMessage,
  });

  RegisterButtonHandlers({
    ids,
    draft,
    stepState,
    componentRouter,
    buttonResponder,
    serverDb: databases.serverDb,
    guildId: String(guild.id),
    ownerId: String(interaction.user.id),
    updateMessage: setupContext.updateMessage,
  });

  RegisterFeatureToggleHandlers(setupContext);

  await interactionResponder.Reply(interaction, {
    embeds: [BuildSetupEmbed(setupContext).toJSON()],
    components: BuildStepComponents(setupContext),
    flags: MessageFlags.Ephemeral,
  });
}

export const SetupCommand = CreateCommand({
  name: "setup",
  description: "Interactive guided setup for roles, features, and channels",
  group: "admin",
  config: Config.admin(),
  execute: ExecuteSetup,
});
