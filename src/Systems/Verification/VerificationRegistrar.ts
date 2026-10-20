import { DefineSystemRegistrar } from "@shared/SystemRegistrar";
import { RegisterVerificationPanelButton } from "@systems/Verification/VerificationPanelFlow";

export const VerificationRegistrar = DefineSystemRegistrar(
  "verification",
  RegisterVerificationPanelButton,
);
