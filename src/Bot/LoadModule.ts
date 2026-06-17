import { join } from "path";
import { pathToFileURL } from "url";

export function ResolveModulePath(
  basePath: string,
  relativePath: string,
): string {
  return join(basePath, ...String(relativePath).split(/[/\\]/));
}

export async function LoadModule(
  filePath: string,
): Promise<Record<string, unknown>> {
  if (filePath.endsWith(".js")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(filePath) as Record<string, unknown>;
  }

  const module = await import(pathToFileURL(filePath).href);
  return module as Record<string, unknown>;
}
