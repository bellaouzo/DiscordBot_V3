import { ComponentRouter } from "@shared/ComponentRouter";
import { ButtonResponder } from "@responders/ButtonResponder";
import { EmbedFactory } from "@utilities";
import { ServerDatabase } from "@database/ServerDatabase";
import { SETUP_TIMEOUT_MS } from "../../setup/constants";
import { NavigationIds, SetupDraft, StepState } from "../../setup/state";

interface RegisterButtonHandlersOptions {
  ids: NavigationIds;
  draft: SetupDraft;
  stepState: StepState;
  componentRouter: ComponentRouter;
  buttonResponder: ButtonResponder;
  serverDb: ServerDatabase;
  guildId: string;
  ownerId: string;
  updateMessage: () => Promise<void>;
}

export function RegisterButtonHandlers(
  options: RegisterButtonHandlersOptions
): void {
  const {
    ids,
    draft,
    stepState,
    componentRouter,
    buttonResponder,
    serverDb,
    guildId,
  ownerId,
    updateMessage,
  } = options;

  componentRouter.RegisterButton({
    customId: ids.next,
    ownerId,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      stepState.current = Math.min(stepState.current + 1, 3);
      await buttonResponder.DeferUpdate(buttonInteraction);
      await updateMessage();
    },
  });

  componentRouter.RegisterButton({
    customId: ids.back,
    ownerId,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      stepState.current = Math.max(stepState.current - 1, 1);
      await buttonResponder.DeferUpdate(buttonInteraction);
      await updateMessage();
    },
  });

  componentRouter.RegisterButton({
    customId: ids.cancel,
    ownerId,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);
      await buttonResponder.EditReply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateWarning({
            title: "Setup Cancelled",
            description: "No changes were saved.",
          }).toJSON(),
        ],
        components: [],
      });
    },
  });

  componentRouter.RegisterButton({
    customId: ids.save,
    ownerId,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      const saved = serverDb.UpsertGuildSettings({
        guild_id: guildId,
        admin_role_ids: draft.adminRoleIds,
        mod_role_ids: draft.modRoleIds,
        ticket_category_id: draft.ticketCategoryId,
        command_log_channel_id: draft.commandLogChannelId,
        announcement_channel_id: draft.announcementChannelId,
        delete_log_channel_id: draft.deleteLogChannelId,
        production_log_channel_id: draft.productionLogChannelId,
      });

      await buttonResponder.DeferUpdate(buttonInteraction);
      await buttonResponder.EditReply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateSuccess({
            title: "Setup Saved",
            description:
              "Your configuration has been saved. You can rerun `/setup` anytime to update it.",
          }).toJSON(),
        ],
        components: [],
      });

      draft.adminRoleIds = [...saved.admin_role_ids];
      draft.modRoleIds = [...saved.mod_role_ids];
      draft.ticketCategoryId = saved.ticket_category_id;
      draft.commandLogChannelId = saved.command_log_channel_id;
      draft.announcementChannelId = saved.announcement_channel_id;
      draft.deleteLogChannelId = saved.delete_log_channel_id;
      draft.productionLogChannelId = saved.production_log_channel_id;
    },
  });
}

