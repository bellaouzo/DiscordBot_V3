import { FEATURE_MODULES } from "../features/FeatureModules";
import {
  GetDraftFeatureEnabled,
  SetDraftFeatureEnabled,
} from "../features/FeatureModules";
import { SETUP_TIMEOUT_MS } from "../constants";
import type { SetupContext } from "../steps/types";

export function RegisterFeatureToggleHandlers(context: SetupContext): void {
  FEATURE_MODULES.forEach((module) => {
    context.componentRouter.RegisterButton({
      customId: context.ids.featureToggleIds[module.id],
      ownerId: context.ownerId,
      expiresInMs: SETUP_TIMEOUT_MS,
      handler: async (buttonInteraction) => {
        const current = GetDraftFeatureEnabled(context.draft, module.id);
        SetDraftFeatureEnabled(context.draft, module.id, !current);

        if (
          module.id === "starboard" &&
          !GetDraftFeatureEnabled(context.draft, module.id)
        ) {
          context.draft.starboardChannelId = null;
        }

        await context.buttonResponder.DeferUpdate(buttonInteraction);
        await context.updateMessage();
      },
    });
  });
}
