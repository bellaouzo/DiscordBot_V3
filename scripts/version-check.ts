import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
const pkg = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as { version: string };
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");

const releasedVersions = [
  ...changelog.matchAll(/^## \[([0-9]+\.[0-9]+\.[0-9]+)\]/gm),
].map((match) => match[1]);

if (releasedVersions.length === 0) {
  console.log(
    `No released version section in CHANGELOG.md; package.json is ${pkg.version}`,
  );
  process.exit(0);
}

const latest = releasedVersions[0];
if (latest !== pkg.version) {
  console.error(
    `Version mismatch: package.json is ${pkg.version} but latest CHANGELOG release is [${latest}]`,
  );
  process.exit(1);
}

console.log(`Version check passed: ${pkg.version}`);
