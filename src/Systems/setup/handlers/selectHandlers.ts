import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { LoadAppConfig } from "@config/AppConfig";
import { CreateChannelManager } from "@utilities";
import { SelectMenuRouter } from "@shared/SelectMenuRouter";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  DEFAULT_TICKET_CATEGORY,
  SETUP_TIMEOUT_MS,
} from "../../Setup/constants";
import { NavigationIds, SetupDraft, SetupResources } from "../../Setup/state";

interface RegisterSelectHandlersOptions {
  interaction: ChatInputCommandInteraction;
  draft: SetupDraft;
  resources: SetupResources;
  ids: NavigationIds;
  loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
  channelManager: ReturnType<typeof CreateChannelManager>;
  selectMenuRouter: SelectMenuRouter;
  updateMessage: () => Promise<void>;
}

export function RegisterSelectHandlers(
  options: RegisterSelectHandlersOptions
): void {
  const {
    interaction,
    draft,
    resources,
    ids,
    loggingDefaults,
    channelManager,
    selectMenuRouter,
    updateMessage,
  } = options;

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.adminSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selected = selectInteraction.values.filter(
        (value) => value !== "none"
      );
      draft.adminRoleIds = selected;

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.modSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selected = selectInteraction.values.filter(
        (value) => value !== "none"
      );
      draft.modRoleIds = selected;

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.ticketSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.ticketCategoryId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateCategory(
          DEFAULT_TICKET_CATEGORY
        );
        if (created) {
          draft.ticketCategoryId = created.id;
          if (
            !resources.categories.find((category) => category.id === created.id)
          ) {
            resources.categories.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the ticket category. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.ticketCategoryId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.commandLogSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.commandLogChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          loggingDefaults.commandLogChannelName,
          loggingDefaults.commandLogCategoryName
        );
        if (created) {
          draft.commandLogChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the command log channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.commandLogChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.deleteLogSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.deleteLogChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          loggingDefaults.messageDeleteChannelName || DEFAULT_DELETE_LOG_CHANNEL
        );
        if (created) {
          draft.deleteLogChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the delete logs channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (selection === "none") {
        draft.deleteLogChannelId = null;
      } else {
        draft.deleteLogChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.productionLogSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.productionLogChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          loggingDefaults.deployLogChannelName || DEFAULT_PRODUCTION_LOG_CHANNEL
        );
        if (created) {
          draft.productionLogChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the production logs channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (selection === "none") {
        draft.productionLogChannelId = null;
      } else {
        draft.productionLogChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.announcementSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.announcementChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          DEFAULT_ANNOUNCEMENT_CHANNEL
        );
        if (created) {
          draft.announcementChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the announcements channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.announcementChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });
}

