import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { LoadAppConfig } from "@config/AppConfig";
import type { CreateChannelManager } from "@utilities";
import type { SelectMenuRouter } from "@shared/SelectMenuRouter";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  DEFAULT_APPEAL_CATEGORY,
  DEFAULT_TICKET_CATEGORY,
  SETUP_TIMEOUT_MS,
} from "../../Setup/constants";
import type {
  NavigationIds,
  SetupDraft,
  SetupResources,
} from "../../Setup/state";
import { PromoteResourceItem } from "../resources";

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
  options: RegisterSelectHandlersOptions,
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
        (value) => value !== "none" && value !== "noop",
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
        (value) => value !== "none" && value !== "noop",
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
          DEFAULT_TICKET_CATEGORY,
        );
        if (created) {
          draft.ticketCategoryId = created.id;
          PromoteResourceItem(resources.categories, created);
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
    customId: ids.appealSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.appealReviewCategoryId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateCategory(
          DEFAULT_APPEAL_CATEGORY,
        );
        if (created) {
          draft.appealReviewCategoryId = created.id;
          PromoteResourceItem(resources.categories, created);
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the appeal category. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.appealReviewCategoryId = selection;
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
          loggingDefaults.commandLogCategoryName,
        );
        if (created) {
          draft.commandLogChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
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
    customId: ids.ticketLogSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.ticketLogChannelId = null;
      } else if (selection === "create") {
        const created =
          await channelManager.GetOrCreateTextChannel("ticket-logs");
        if (created) {
          draft.ticketLogChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the ticket logs channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.ticketLogChannelId = selection;
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
          loggingDefaults.messageDeleteChannelName ||
            DEFAULT_DELETE_LOG_CHANNEL,
        );
        if (created) {
          draft.deleteLogChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
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
          loggingDefaults.deployLogChannelName ||
            DEFAULT_PRODUCTION_LOG_CHANNEL,
        );
        if (created) {
          draft.productionLogChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
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
          DEFAULT_ANNOUNCEMENT_CHANNEL,
        );
        if (created) {
          draft.announcementChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
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

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.welcomeSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.welcomeChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel("welcome");
        if (created) {
          draft.welcomeChannelId = created.id;
          PromoteResourceItem(resources.textChannels, created);
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the welcome channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.welcomeChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  registerOptionalChannelSelect({
    interaction,
    draft,
    resources,
    channelManager,
    selectMenuRouter,
    updateMessage,
    customId: ids.starboardChannelSelect,
    assign: (value) => {
      draft.starboardChannelId = value;
    },
    defaultName: "starboard",
  });

  registerOptionalChannelSelect({
    interaction,
    draft,
    resources,
    channelManager,
    selectMenuRouter,
    updateMessage,
    customId: ids.levelUpChannelSelect,
    assign: (value) => {
      draft.levelUpChannelId = value;
    },
    defaultName: "level-up",
    allowNone: true,
  });

  registerOptionalChannelSelect({
    interaction,
    draft,
    resources,
    channelManager,
    selectMenuRouter,
    updateMessage,
    customId: ids.verificationChannelSelect,
    assign: (value) => {
      draft.verificationChannelId = value;
    },
    defaultName: "verification",
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.unverifiedRoleSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];
      draft.unverifiedRoleId =
        selection === "none" || selection === "noop" ? null : selection;
      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.verifiedRoleSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];
      draft.verifiedRoleId =
        selection === "none" || selection === "noop" ? null : selection;
      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });
}

function registerOptionalChannelSelect(options: {
  interaction: RegisterSelectHandlersOptions["interaction"];
  draft: SetupDraft;
  resources: SetupResources;
  channelManager: RegisterSelectHandlersOptions["channelManager"];
  selectMenuRouter: SelectMenuRouter;
  updateMessage: () => Promise<void>;
  customId: string;
  assign: (value: string | null) => void;
  defaultName: string;
  allowNone?: boolean;
}): void {
  const {
    interaction,
    resources,
    channelManager,
    selectMenuRouter,
    updateMessage,
    customId,
    assign,
    defaultName,
    allowNone = false,
  } = options;

  selectMenuRouter.RegisterSelectMenu({
    customId,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        assign(null);
      } else if (selection === "create") {
        const created =
          await channelManager.GetOrCreateTextChannel(defaultName);
        if (created) {
          assign(created.id);
          PromoteResourceItem(resources.textChannels, created);
        } else {
          await selectInteraction.followUp({
            content: `Could not create #${defaultName}. Check bot permissions.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (selection === "none" && allowNone) {
        assign(null);
      } else {
        assign(selection);
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });
}
