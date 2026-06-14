import moduleAlias from "module-alias";
import { readFileSync } from "fs";
import path from "path";

const isSourceRun =
  process.env.RUN_FROM_SOURCE === "1" ||
  !__dirname.endsWith(`${path.sep}dist`);

if (!isSourceRun) {
  const projectRoot = path.join(__dirname, "..");
  const packageJson = JSON.parse(
    readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  ) as { _moduleAliases?: Record<string, string> };

  if (packageJson._moduleAliases) {
    const resolvedAliases = Object.fromEntries(
      Object.entries(packageJson._moduleAliases).map(([alias, target]) => [
        alias,
        path.join(projectRoot, target),
      ]),
    );
    moduleAlias.addAliases(resolvedAliases);
  }
}
