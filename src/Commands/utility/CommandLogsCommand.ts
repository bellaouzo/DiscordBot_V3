import { AttachmentBuilder, ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import {
  LoggingMiddleware,
  ErrorMiddleware,
  PermissionMiddleware,
} from "@middleware";
import { EmbedFactory } from "@utilities";
import {
  FormatLogs,
  GetLogsForUser,
  LogExportFormat,
} from "@utilities/CommandLogStore";
import fs from "fs";
import path from "path";

const DEFAULT_LIMIT = 100;
const EXPORT_PREFIX = "command-logs-";
const MAX_EXPORT_FILES = 50;

async function HandleExport(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);
  const limit = interaction.options.getInteger("limit") ?? DEFAULT_LIMIT;
  const startStr = interaction.options.getString("start_date");
  const endStr = interaction.options.getString("end_date");
  const format =
    (interaction.options.getString("format") as LogExportFormat | null) ??
    "txt";

  await context.responders.interactionResponder.Defer(interaction, true);

  const start = ParseDate(startStr);
  const end = ParseDate(endStr);
  if (startStr && !start) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Start Date",
      description: "Use an ISO date like 2024-05-20 or 2024-05-20T15:30:00Z.",
    });
    await context.responders.interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
    return;
  }

  if (endStr && !end) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid End Date",
      description: "Use an ISO date like 2024-05-20 or 2024-05-20T15:30:00Z.",
    });
    await context.responders.interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
    return;
  }

  const logs = await GetLogsForUser(targetUser.id, limit, {
    start: start ?? undefined,
    end: end ?? undefined,
    guildId: interaction.guildId ?? null,
  });

  if (logs.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Logs",
      description: BuildNoLogsDescription(targetUser.tag, start, end),
    });
    await context.responders.interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
    return;
  }

  const buffer = FormatLogs(logs, format);
  const extension = format;
  const filename = `command-logs-${targetUser.id}-${Date.now()}.${extension}`;
  const filePath = path.join(process.cwd(), "logs", filename);
  await fs.promises.writeFile(filePath, buffer);

  await PruneOldExports(path.dirname(filePath), MAX_EXPORT_FILES);

  const file = new AttachmentBuilder(filePath, { name: filename });

  await context.responders.interactionResponder.Edit(interaction, {
    content: `Exported ${logs.length} log${logs.length === 1 ? "" : "s"} for ${targetUser.tag}.`,
    files: [file],
  });
}

export const CommandLogsCommand = CreateCommand({
  name: "commandlogs",
  description: "Export command logs for a user",
  group: "utility",
  configure: (builder) => {
    builder.addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription("Export command logs for a user")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Target user").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Max logs to include (default 100)")
            .setMinValue(1)
            .setMaxValue(1000)
        )
        .addStringOption((opt) =>
          opt
            .setName("start_date")
            .setDescription("ISO start date (e.g., 2024-05-20)")
        )
        .addStringOption((opt) =>
          opt
            .setName("end_date")
            .setDescription("ISO end date (e.g., 2024-05-21T12:00:00Z)")
        )
        .addStringOption((opt) =>
          opt
            .setName("format")
            .setDescription("Export format")
            .addChoices(
              { name: "txt", value: "txt" },
              { name: "csv", value: "csv" }
            )
        )
    );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: {
    permissions: {
      required: ["ManageGuild"],
      requireAny: false,
    },
    cooldown: { seconds: 5 },
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "export") {
      await HandleExport(interaction, context);
      return;
    }
  },
});

function ParseDate(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return ms;
}

function BuildNoLogsDescription(
  userTag: string,
  start: number | null,
  end: number | null
): string {
  const parts: string[] = [`No command logs found for ${userTag}`];

  if (start && end) {
    parts.push(
      `between ${new Date(start).toISOString()} and ${new Date(
        end
      ).toISOString()}.`
    );
  } else if (start) {
    parts.push(`at or after ${new Date(start).toISOString()}.`);
  } else if (end) {
    parts.push(`at or before ${new Date(end).toISOString()}.`);
  } else {
    parts.push(".");
  }

  return parts.join(" ");
}

async function PruneOldExports(dir: string, maxFiles: number): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir);
    const targets = entries.filter(
      (name) =>
        name.startsWith(EXPORT_PREFIX) &&
        (name.endsWith(".txt") || name.endsWith(".csv"))
    );

    if (targets.length <= maxFiles) {
      return;
    }

    const withTime = await Promise.all(
      targets.map(async (name) => {
        const stat = await fs.promises.stat(path.join(dir, name));
        return { name, mtime: stat.mtimeMs };
      })
    );

    withTime.sort((a, b) => b.mtime - a.mtime);
    const toDelete = withTime.slice(maxFiles);

    await Promise.all(
      toDelete.map((entry) =>
        fs.promises.unlink(path.join(dir, entry.name)).catch(() => undefined)
      )
    );
  } catch {
    // ignore prune errors
  }
}
