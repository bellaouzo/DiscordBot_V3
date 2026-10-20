import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";

/**
 * Scaffolds a slash command and its test.
 *
 *   npm run new:command -- <Group> <Name> [--subcommands]
 *   npm run new:command -- Utility Remind
 *
 * Creates src/Commands/<Group>/<Name>Command.ts (discovered automatically, no registration
 * needed) and tests/commands/<Group>/<Name>Command.test.ts. Never overwrites files.
 */

const root = join(__dirname, "..");

function ToPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function ToSlashName(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .slice(0, 32);
}

function CommandSource(options: {
  name: string;
  slashName: string;
  group: string;
  subcommands: boolean;
}): string {
  const { name, slashName, group } = options;

  if (options.subcommands) {
    return `import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";

async function ExecuteShow(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  await context.responders.interactionResponder.Reply(interaction, {
    content: "TODO: implement /${slashName} show",
  });
}

export const ${name}Command = CreateCommand({
  name: "${slashName}",
  description: "TODO: describe /${slashName}",
  group: "${group}",
  config: Config.utility(3),
  subcommands: [
    {
      name: "show",
      description: "TODO: describe this subcommand",
      execute: ExecuteShow,
    },
  ],
});
`;
  }

  return `import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";

async function Execute${name}(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  await context.responders.interactionResponder.Reply(interaction, {
    content: "TODO: implement /${slashName}",
  });
}

export const ${name}Command = CreateCommand({
  name: "${slashName}",
  description: "TODO: describe /${slashName}",
  group: "${group}",
  config: Config.utility(3),
  execute: Execute${name},
});
`;
}

function TestSource(options: {
  name: string;
  groupDir: string;
  subcommands: boolean;
}): string {
  const { name, groupDir } = options;
  const arrange = options.subcommands
    ? `    const interaction = createMockInteraction();
    stubInteractionOptions(interaction, {
      getSubcommand: () => "show",
      getSubcommandGroup: () => null,
    });`
    : `    const interaction = createMockInteraction();`;
  const helpers = options.subcommands
    ? "createMockContext, createMockInteraction, stubInteractionOptions"
    : "createMockContext, createMockInteraction";

  return `import { describe, expect, it } from "vitest";
import { ${name}Command } from "@commands/${groupDir}/${name}Command";
import { ${helpers} } from "../../helpers";

describe("${name}Command", () => {
  it("replies to the user", async () => {
${arrange}
    const context = createMockContext();

    await ${name}Command.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledOnce();
  });
});
`;
}

function WriteNewFile(path: string, content: string): void {
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite ${relative(root, path)}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`created ${relative(root, path)}`);
}

function Main(argv: string[]): void {
  const subcommands = argv.includes("--subcommands");
  const [groupArg, nameArg] = argv.filter((arg) => !arg.startsWith("--"));
  if (!groupArg || !nameArg) {
    console.error(
      "Usage: npm run new:command -- <Group> <Name> [--subcommands]",
    );
    process.exit(1);
  }

  const groupDir = ToPascalCase(groupArg);
  const name = ToPascalCase(nameArg).replace(/Command$/, "");
  const slashName = ToSlashName(name);
  const commandPath = join(
    root,
    "src",
    "Commands",
    groupDir,
    `${name}Command.ts`,
  );
  const testPath = join(
    root,
    "tests",
    "commands",
    groupDir,
    `${name}Command.test.ts`,
  );

  for (const path of [commandPath, testPath]) {
    if (existsSync(path)) {
      console.error(`Refusing to overwrite ${relative(root, path)}`);
      process.exit(1);
    }
  }

  WriteNewFile(
    commandPath,
    CommandSource({
      name,
      slashName,
      group: groupDir.toLowerCase(),
      subcommands,
    }),
  );
  WriteNewFile(testPath, TestSource({ name, groupDir, subcommands }));
  execFileSync("npx", ["prettier", "--write", commandPath, testPath], {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  console.log(
    `\nNext: fill in the TODOs, then \`npm test\`. /${slashName} is picked up automatically on the next start.`,
  );
}

Main(process.argv.slice(2));
