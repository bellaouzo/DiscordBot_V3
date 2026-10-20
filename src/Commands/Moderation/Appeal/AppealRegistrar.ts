import { DefineSystemRegistrar } from "@shared/SystemRegistrar";
import { RegisterAppealPanelButton } from "@commands/Moderation/Appeal/AppealPanelFlow";

export const AppealRegistrar = DefineSystemRegistrar(
  "appeals",
  RegisterAppealPanelButton,
);
