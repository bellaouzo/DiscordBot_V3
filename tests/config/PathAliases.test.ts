import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";

// tsconfig.json drives type-checking and tsx; package.json `_moduleAliases` drives the
// compiled bot (module-alias) and vitest. They must describe the same directories.
const root = path.resolve(__dirname, "../..");
const tsconfig = JSON.parse(
  readFileSync(path.join(root, "tsconfig.json"), "utf8"),
) as { compilerOptions: { baseUrl: string; paths: Record<string, string[]> } };
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { _moduleAliases: Record<string, string> };

const { baseUrl, paths } = tsconfig.compilerOptions;
const runtimeAliases = packageJson._moduleAliases;
const projectAliases = Object.keys(paths).filter((key) => key.startsWith("@"));

describe("path aliases", () => {
  it("defines every tsconfig alias at runtime and vice versa", () => {
    const tsAliasNames = new Set(
      projectAliases.map((key) => key.replace(/\/\*$/, "")),
    );
    expect([...tsAliasNames].sort()).toEqual(
      Object.keys(runtimeAliases).sort(),
    );
  });

  it.each(projectAliases.filter((key) => key.endsWith("/*")))(
    "%s points at the same directory in tsconfig and at runtime",
    (key) => {
      const alias = key.replace(/\/\*$/, "");
      const tsDir = paths[key][0].replace(/\/\*$/, "");
      const runtimeDir = runtimeAliases[alias].replace(/^dist\//, "");
      expect(tsDir).toBe(runtimeDir);
    },
  );

  // module-alias resolves a bare alias to `<dir>/index.js`, so a bare tsconfig alias must
  // point at that same index module or imports that type-check will fail in production.
  it.each(projectAliases.filter((key) => !key.endsWith("/*")))(
    "bare %s resolves to an index module that exists",
    (key) => {
      const target = paths[key][0];
      const runtimeDir = runtimeAliases[key].replace(/^dist\//, "");
      expect(target).toBe(`${runtimeDir}/index`);
      expect(existsSync(path.join(root, baseUrl, `${target}.ts`))).toBe(true);
    },
  );
});
