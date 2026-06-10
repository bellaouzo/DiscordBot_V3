import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";
import {
  AppendCommandLog,
  FormatLogs,
  GetLogsForUser,
  type CommandLogEntry,
} from "@utilities/CommandLogStore";
import { createMockInteraction, stubInteractionOptions } from "../helpers";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "command-log.ndjson");

const sampleLogs: CommandLogEntry[] = [
  {
    timestamp: 1_700_000_000_000,
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "user-1",
    command: "ping",
    group: "utility",
  },
  {
    timestamp: 1_700_000_100_000,
    guildId: "guild-2",
    channelId: "channel-2",
    userId: "user-1",
    command: "help",
    group: "utility",
    subcommand: "list",
    options: { page: 1 },
  },
];

describe("CommandLogStore", () => {
  afterEach(() => {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
  });

  it("formats logs as CSV", () => {
    const buffer = FormatLogs(sampleLogs, "csv");
    const text = buffer.toString("utf8");

    expect(text).toContain("timestamp,guildId,channelId,userId,command");
    expect(text).toContain("ping");
    expect(text).toContain("help");
  });

  it("formats logs as plain text", () => {
    const buffer = FormatLogs(sampleLogs, "txt");
    const text = buffer.toString("utf8");

    expect(text).toContain("ping");
    expect(text).toContain("help list");
    expect(text).toContain("page=1");
  });

  it("appends command logs with subcommand option maps", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      user: { id: "user-1" } as never,
    });
    (interaction as unknown as { channelId: string }).channelId = "channel-1";
    stubInteractionOptions(interaction, {
      getSubcommand: (required?: boolean) =>
        required === false ? "export" : "export",
    });
    interaction.options.data = [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "export",
        options: [{ name: "limit", value: 25 }],
      },
    ] as never;

    await AppendCommandLog(interaction, {
      data: { name: "commandlogs" },
      group: "utility",
    } as never);

    const logs = await GetLogsForUser("user-1", 5);
    expect(logs[0]?.subcommand).toBe("export");
    expect(logs[0]?.options).toEqual({ limit: 25 });
  });

  it("filters persisted logs by user, guild, and date range", async () => {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(
      LOG_FILE,
      sampleLogs.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );

    const logs = await GetLogsForUser("user-1", 10, {
      guildId: "guild-1",
      start: 1_699_999_999_000,
      end: 1_700_000_050_000,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].command).toBe("ping");
  });
});
