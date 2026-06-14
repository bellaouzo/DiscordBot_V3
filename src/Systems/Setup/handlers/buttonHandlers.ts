import type { ComponentRouter } from "@shared/ComponentRouter";
import type { ButtonResponder } from "@responders/ButtonResponder";
import { EmbedFactory } from "@utilities";
import type { ServerDatabase } from "@database/ServerDatabase";
import { SETUP_TIMEOUT_MS, SETUP_STEP_COUNT } from "../constants";
import type { NavigationIds, SetupDraft, StepState } from "../state";
import { SaveSetupDraft } from "../persistence/SaveSetupDraft";
import { SyncDraftFromSavedSettings } from "../persistence/SyncDraftFromSavedSettings";

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
  options: RegisterButtonHandlersOptions,
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
      stepState.current = Math.min(stepState.current + 1, SETUP_STEP_COUNT);
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
    customId: ids.saveAndQuit,
    ownerId,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      const result = SaveSetupDraft({ serverDb, guildId, draft });

      if (!result.success) {
        await buttonResponder.Reply(buttonInteraction, {
          embeds: [
            EmbedFactory.CreateError({
              title: "Setup Not Saved",
              description: result.error,
            }).toJSON(),
          ],
          flags: 64,
        });
        return;
      }

      SyncDraftFromSavedSettings(draft, result.guildSettings, serverDb, guildId);

      await buttonResponder.DeferUpdate(buttonInteraction);
      await buttonResponder.EditReply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateSuccess({
            title: "Setup Complete",
            description: [
              "Your server configuration has been saved.",
              "Use `/hub` for quick actions or `/help` to browse commands.",
            ].join("\n"),
          }).toJSON(),
        ],
        components: [],
      });
    },
  });
}
