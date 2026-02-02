import fs from "fs";
import path from "path";
import { ChatInputCommandInteraction } from "discord.js";
import { CommandDefinition } from "@commands";
import { SafeParseJson, isRecord } from "./SafeJson";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "command-log.ndjson");

export type CommandLogEntry = {
  timestamp: number;
  guildId: string | null;
  channelId: string | null;
  userId: string;
  command: string;
  group?: string;
  subcommand?: string;
  options?: Record<string, unknown>;
};

function isCommandLogEntry(data: unknown): data is CommandLogEntry {
  if (!isRecord(data)) return false;
  return (
    typeof data.timestamp === "number" &&
    typeof data.userId === "string" &&
    typeof data.command === "string"
  );
}

function EnsureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export async function AppendCommandLog(
  interaction: ChatInputCommandInteraction,
  command: CommandDefinition
): Promise<void> {
  EnsureLogDir();

  const data: CommandLogEntry = {
    timestamp: Date.now(),
    guildId: interaction.guildId ?? null,
    channelId: interaction.channelId ?? null,
    userId: interaction.user.id,
    command: command.data.name,
    group: command.group,
    subcommand: interaction.options.getSubcommand(false) ?? undefined,
    options: BuildOptionMap(interaction),
  };

  const line = JSON.stringify(data);
  await fs.promises.appendFile(LOG_FILE, `${line}\n`, { encoding: "utf8" });
}

export async function GetLogsForUser(
  userId: string,
  limit = 100,
  options?: {
    start?: number;
    end?: number;
    guildId?: string | null;
  }
): Promise<CommandLogEntry[]> {
  EnsureLogDir();
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const content = await fs.promises.readFile(LOG_FILE, "utf8");
  const lines = content.split("\n").filter(Boolean);
  const results: CommandLogEntry[] = [];

  for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
    const result = SafeParseJson(lines[i], isCommandLogEntry);
    if (!result.success || !result.data) {
      continue;
    }
    const entry = result.data;
    if (
      entry.userId === userId &&
      (!options?.guildId || entry.guildId === options.guildId) &&
      (!options?.start || entry.timestamp >= options.start) &&
      (!options?.end || entry.timestamp <= options.end)
    ) {
      results.push(entry);
    }
  }

  return results.reverse();
}

export type LogExportFormat = "txt" | "csv";

export function FormatLogs(
  logs: CommandLogEntry[],
  format: LogExportFormat
): Buffer {
  if (format === "csv") {
    const header = [
      "timestamp",
      "guildId",
      "channelId",
      "userId",
      "command",
      "subcommand",
      "options",
    ];
    const rows = logs.map((entry) => {
      const cols = [
        new Date(entry.timestamp).toISOString(),
        entry.guildId ?? "",
        entry.channelId ?? "",
        entry.userId,
        entry.command,
        entry.subcommand ?? "",
        entry.options ? JSON.stringify(entry.options) : "",
      ];
      return cols.map(EscapeCsv).join(",");
    });
    return Buffer.from([header.join(","), ...rows].join("\n"), "utf8");
  }

  const lines = logs.map((entry) => FormatLine(entry));
  return Buffer.from(lines.join("\n"), "utf8");
}

function FormatLine(entry: CommandLogEntry): string {
  const date = new Date(entry.timestamp).toISOString();
  const locationParts = [
    entry.guildId ? `Guild: ${entry.guildId}` : "Guild: n/a",
    entry.channelId ? `Channel: ${entry.channelId}` : "Channel: n/a",
  ];
  const args = entry.options
    ? Object.entries(entry.options)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")
    : "none";
  const sub = entry.subcommand ? ` ${entry.subcommand}` : "";
  return `[${date}] ${entry.command}${sub} | ${locationParts.join(
    " | "
  )} | args: ${args}`;
}

function EscapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function BuildOptionMap(
  interaction: ChatInputCommandInteraction
): Record<string, unknown> | undefined {
  const data = interaction.options.data;
  if (!data || data.length === 0) {
    return undefined;
  }

  const first = data[0];
  if (first.type === 1 && first.options) {
    const map: Record<string, unknown> = {};
    for (const opt of first.options) {
      map[opt.name] = opt.value;
    }
    return map;
  }

  const map: Record<string, unknown> = {};
  for (const opt of data) {
    map[opt.name] = opt.value;
  }
  return map;
}
