import { readdirSync } from "fs";
import { join } from "path";
import { LoadModule, ResolveModulePath } from "@bot/LoadModule";
import type {
  SystemRegistrarDefinition,
  SystemRegistrationContext,
} from "@shared/SystemRegistrar";
import { IsSystemRegistrarDefinition } from "@shared/SystemRegistrar";

export type {
  SystemRegistrar,
  SystemRegistrationContext,
} from "@shared/SystemRegistrar";

const REGISTRAR_ROOTS = ["Systems", "Commands"];

function IsRegistrarFile(file: string): boolean {
  return /Registrar\.(js|ts)$/.test(file) && !file.endsWith(".d.ts");
}

/**
 * Finds every `*Registrar.ts` under src/Systems and src/Commands and returns the
 * registrars they export, ordered by file path.
 */
export async function LoadSystemRegistrars(): Promise<
  SystemRegistrarDefinition[]
> {
  const registrars: SystemRegistrarDefinition[] = [];
  const failures: string[] = [];

  for (const root of REGISTRAR_ROOTS) {
    const rootPath = join(__dirname, "..", root);
    const files = (readdirSync(rootPath, { recursive: true }) as string[])
      .filter(IsRegistrarFile)
      .sort();

    for (const file of files) {
      try {
        const module = await LoadModule(ResolveModulePath(rootPath, file));
        registrars.push(
          ...Object.values(module).filter(IsSystemRegistrarDefinition),
        );
      } catch (error) {
        failures.push(`- ${root}/${file}: ${String(error)}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed to load ${failures.length} registrar file(s):\n${failures.join("\n")}`,
    );
  }

  return registrars;
}

export async function RegisterAllSystems(
  context: SystemRegistrationContext,
): Promise<void> {
  const registrars = await LoadSystemRegistrars();
  for (const registrar of registrars) {
    registrar.register(context);
  }
  context.logger.Debug("Registered systems", {
    extra: { registrars: registrars.map((registrar) => registrar.name) },
  });
}
