// Test push
import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

interface ApodResponse {
  readonly title?: string;
  readonly explanation?: string;
  readonly url?: string;
  readonly hdurl?: string;
  readonly media_type?: string;
  readonly date?: string;
}

const apiConfig = LoadApiConfig();

function ValidateApodDate(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }

  // Basic YYYY-MM-DD check
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Ensure the constructed date matches the components (catches 2023-02-30)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }

  const today = new Date();
  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const inputUTC = Date.UTC(year, month - 1, day);

  if (inputUTC > todayUTC) {
    throw new Error("Date cannot be in the future.");
  }

  return input.trim();
}

async function ExecuteApod(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const apodDate = ValidateApodDate(interaction.options.getString("date"));

  const response = await RequestJson<ApodResponse>(apiConfig.apod.url, {
    query: {
      api_key: apiConfig.apod.apiKey,
      ...(apodDate ? { date: apodDate } : {}),
    },
    timeoutMs: apiConfig.apod.timeoutMs,
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? "APOD API request failed");
  }

  const { title, url, hdurl, media_type, date } = response.data;
  if (!title) {
    throw new Error("APOD API returned incomplete data");
  }

  const imageUrl = media_type === "image" ? hdurl || url : undefined;

  const embed = EmbedFactory.Create({
    title: `🌌 ${title}`,
    image: imageUrl,
    footer: date ? `Date: ${date}` : undefined,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const ApodCommand = CreateCommand({
  name: "apod",
  description: "Show NASA's Astronomy Picture of the Day",
  group: "fun",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  configure: (builder) => {
    builder.addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date to fetch (YYYY-MM-DD, defaults to today)")
        .setRequired(false)
    );
  },
  execute: ExecuteApod,
});
