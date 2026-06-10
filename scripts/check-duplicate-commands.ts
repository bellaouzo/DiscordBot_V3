import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const commandsRoot = join(__dirname, "..", "src", "Commands");

function isCommandFile(file: string): boolean {
  if (!/Command\.ts$/.test(file) || file.endsWith(".d.ts")) {
    return false;
  }
  if (file.includes("CommandFactory.") || file.includes("registry.")) {
    return false;
  }
  return true;
}

function collectCommandFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCommandFiles(filePath));
      continue;
    }
    if (isCommandFile(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function extractTopLevelCommandName(filePath: string): string | null {
  const content = readFileSync(filePath, "utf8");
  if (!content.includes("CreateCommand(")) {
    return null;
  }

  const match = content.match(
    /CreateCommand\(\s*\{[\s\S]*?\bname:\s*["'`]([^"'`]+)["'`]/,
  );
  return match?.[1] ?? null;
}

const seen = new Map<string, string>();
const duplicates: string[] = [];

for (const file of collectCommandFiles(commandsRoot)) {
  const name = extractTopLevelCommandName(file);
  if (!name) {
    continue;
  }

  const previous = seen.get(name);
  if (previous) {
    duplicates.push(
      `Duplicate command name "${name}" in ${file} and ${previous}`,
    );
    continue;
  }
  seen.set(name, file);
}

if (duplicates.length > 0) {
  console.error(duplicates.join("\n"));
  process.exit(1);
}

console.log(`Checked ${seen.size} command name(s); no duplicates found.`);
