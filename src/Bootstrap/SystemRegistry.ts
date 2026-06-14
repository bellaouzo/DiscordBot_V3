import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { Logger } from "@shared/Logger";
import type { AppConfig } from "@config/AppConfig";
import { RegisterAppealPanelButton } from "@commands/Moderation/Appeal/AppealPanelFlow";
import { RegisterTicketButtons } from "@systems/Ticket/TicketButtonRegistry";
import { RegisterTicketPanelButton } from "@systems/Ticket/TicketPanelFlow";
import { RegisterVerificationPanelButton } from "@systems/Verification/VerificationPanelFlow";

export interface SystemRegistrationContext {
  readonly responders: ResponderSet;
  readonly logger: Logger;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

export type SystemRegistrar = (context: SystemRegistrationContext) => void;

export const SYSTEM_REGISTRARS: readonly SystemRegistrar[] = [
  RegisterAppealPanelButton,
  RegisterTicketButtons,
  RegisterTicketPanelButton,
  RegisterVerificationPanelButton,
];

export function RegisterAllSystems(context: SystemRegistrationContext): void {
  for (const register of SYSTEM_REGISTRARS) {
    register(context);
  }
}
