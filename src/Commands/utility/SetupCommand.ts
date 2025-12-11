import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import {
  LoggingMiddleware,
  ErrorMiddleware,
  PermissionMiddleware,
} from "@middleware";
import { Config } from "@middleware/CommandConfig";
import { CreateChannelManager, EmbedFactory } from "@utilities";
import { LoadAppConfig } from "@config/AppConfig";
import {
  CreateEmptySettings,
  NavigationIds,
  SanitizeGuildSettings,
  SetupDraft,
  StepState,
} from "./setup/state";
import { CollectResources } from "./setup/resources";
import { BuildSetupEmbed } from "./setup/builders/embed";
import { BuildStepComponents } from "./setup/builders/components";
import { RegisterSelectHandlers } from "./setup/handlers/selectHandlers";
import { RegisterButtonHandlers } from "./setup/handlers/buttonHandlers";

async function ExecuteSetup(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const {
    interactionResponder,
    selectMenuRouter,
    componentRouter,
    buttonResponder,
  } = context.responders;
  const { logger, databases } = context;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Run this command inside a server to configure the bot.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const channelManager = CreateChannelManager({ guild, logger });
  const loggingDefaults = LoadAppConfig().logging;
  const currentSettings =
    databases.serverDb.GetGuildSettings(guild.id) ??
    CreateEmptySettings(guild.id);

  const sanitizedSettings = await SanitizeGuildSettings(guild, currentSettings);
  const settingsChanged =
    sanitizedSettings.ticket_category_id !==
      currentSettings.ticket_category_id ||
    sanitizedSettings.command_log_channel_id !==
      currentSettings.command_log_channel_id ||
    sanitizedSettings.announcement_channel_id !==
      currentSettings.announcement_channel_id ||
    sanitizedSettings.delete_log_channel_id !==
      currentSettings.delete_log_channel_id ||
    sanitizedSettings.production_log_channel_id !==
      currentSettings.production_log_channel_id;

  if (settingsChanged) {
    databases.serverDb.UpsertGuildSettings({
      guild_id: guild.id,
      admin_role_ids: sanitizedSettings.admin_role_ids,
      mod_role_ids: sanitizedSettings.mod_role_ids,
      ticket_category_id: sanitizedSettings.ticket_category_id,
      command_log_channel_id: sanitizedSettings.command_log_channel_id,
      announcement_channel_id: sanitizedSettings.announcement_channel_id,
      delete_log_channel_id: sanitizedSettings.delete_log_channel_id,
      production_log_channel_id: sanitizedSettings.production_log_channel_id,
    });
  }

  const draft: SetupDraft = {
    adminRoleIds: [...sanitizedSettings.admin_role_ids],
    modRoleIds: [...sanitizedSettings.mod_role_ids],
    ticketCategoryId: sanitizedSettings.ticket_category_id,
    commandLogChannelId: sanitizedSettings.command_log_channel_id,
    announcementChannelId: sanitizedSettings.announcement_channel_id,
    deleteLogChannelId: sanitizedSettings.delete_log_channel_id,
    productionLogChannelId: sanitizedSettings.production_log_channel_id,
  };

  const resources = CollectResources(guild);

  const ids: NavigationIds = {
    adminSelect: `setup:${interaction.id}:admin`,
    modSelect: `setup:${interaction.id}:mod`,
    ticketSelect: `setup:${interaction.id}:ticket`,
    commandLogSelect: `setup:${interaction.id}:cmdlog`,
    deleteLogSelect: `setup:${interaction.id}:deletelog`,
    productionLogSelect: `setup:${interaction.id}:prodlog`,
    announcementSelect: `setup:${interaction.id}:announce`,
    next: `setup:${interaction.id}:next`,
    back: `setup:${interaction.id}:back`,
    save: `setup:${interaction.id}:save`,
    cancel: `setup:${interaction.id}:cancel`,
  };

  const stepState: StepState = { current: 1 };

  const updateMessage = async (): Promise<void> => {
    await interaction.editReply({
      embeds: [
        BuildSetupEmbed({
          draft,
          step: stepState.current,
          guild,
          loggingDefaults,
        }).toJSON(),
      ],
      components: BuildStepComponents({
        step: stepState.current,
        draft,
        resources,
        ids,
        loggingDefaults,
      }),
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
    updateMessage,
  });

  RegisterButtonHandlers({
    ids,
    draft,
    stepState,
    componentRouter,
    buttonResponder,
    serverDb: databases.serverDb,
    guildId: guild.id,
    ownerId: interaction.user.id,
    updateMessage,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [
      BuildSetupEmbed({
        draft,
        step: stepState.current,
        guild,
        loggingDefaults,
      }).toJSON(),
    ],
    components: BuildStepComponents({
      step: stepState.current,
      draft,
      resources,
      ids,
      loggingDefaults,
    }),
    ephemeral: true,
  });
}

export const SetupCommand = CreateCommand({
  name: "setup",
  description: "Interactive first-time setup for roles and channels",
  group: "admin",
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.create()
    .anyPermission("ManageGuild", "Administrator")
    .cooldownSeconds(3)
    .build(),
  execute: ExecuteSetup,
});
