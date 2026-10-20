import type { ResponderSet } from "@responders";
import type { DatabaseSet } from "@database";
import type { AppConfig } from "@config/AppConfig";
import type { Logger } from "./Logger";

export interface SystemRegistrationContext {
  readonly responders: ResponderSet;
  readonly logger: Logger;
  readonly databases: DatabaseSet;
  readonly appConfig: AppConfig;
}

export type SystemRegistrar = (context: SystemRegistrationContext) => void;

export interface SystemRegistrarDefinition {
  readonly kind: "system-registrar";
  readonly name: string;
  readonly register: SystemRegistrar;
}

/**
 * Declares startup registration for handlers that must exist before any command runs,
 * such as persistent panel buttons. Export the result from a file named `*Registrar.ts`
 * under `src/Systems` or `src/Commands`; it is discovered and run at startup.
 */
export function DefineSystemRegistrar(
  name: string,
  register: SystemRegistrar,
): SystemRegistrarDefinition {
  return { kind: "system-registrar", name, register };
}

export function IsSystemRegistrarDefinition(
  value: unknown,
): value is SystemRegistrarDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "system-registrar"
  );
}
