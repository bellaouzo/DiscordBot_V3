import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
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

function ValidateApodDate(input?: string | null): {
  date?: string;
  error?: string;
} {
  if (!input) {
    return {};
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) {
    return { error: "Invalid date format. Use YYYY-MM-DD." };
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: "Invalid calendar date." };
  }

  const today = new Date();
  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const inputUTC = Date.UTC(year, month - 1, day);

  if (inputUTC > todayUTC) {
    return { error: "Date cannot be in the future." };
  }

  return { date: input.trim() };
}

async function ExecuteApod(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const dateValidation = ValidateApodDate(
    interaction.options.getString("date")
  );

  if (dateValidation.error) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Date",
      description: dateValidation.error,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const response = await RequestJson<ApodResponse>(apiConfig.apod.url, {
    query: {
      api_key: apiConfig.apod.apiKey,
      ...(dateValidation.date ? { date: dateValidation.date } : {}),
    },
    timeoutMs: apiConfig.apod.timeoutMs,
  });

  if (!response.ok || !response.data) {
    const embed = EmbedFactory.CreateError({
      title: "API Error",
      description: response.error ?? "APOD API request failed",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const { title, url, hdurl, media_type, date } = response.data;
  if (!title) {
    const embed = EmbedFactory.CreateError({
      title: "API Error",
      description: "APOD API returned incomplete data",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
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
