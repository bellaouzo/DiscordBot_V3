import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, RequireFeatureApiKey } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

type NewsApiArticle = {
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly source?: { name?: string };
  readonly publishedAt?: string;
};

type NewsApiResponse = {
  readonly status?: string;
  readonly totalResults?: number;
  readonly articles?: NewsApiArticle[];
  readonly message?: string;
  readonly code?: string;
};

const apiConfig = LoadApiConfig();
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function Truncate(text: string, max = 220): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function FormatArticle(article: NewsApiArticle, index: number): string | null {
  const title = article.title?.trim();
  const url = article.url?.trim();
  if (!title || !url) {
    return null;
  }

  const description = article.description
    ? Truncate(article.description)
    : undefined;
  const source = article.source?.name?.trim();
  const published =
    article.publishedAt && !Number.isNaN(Date.parse(article.publishedAt))
      ? `<t:${Math.floor(new Date(article.publishedAt).getTime() / 1000)}:R>`
      : undefined;

  const meta = [source, published].filter(Boolean).join(" • ");

  return [
    `**${index + 1}. [${title}](${url})**`,
    description,
    meta.length > 0 ? meta : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function BuildNewsEmbed(
  heading: string,
  articles: NewsApiArticle[]
): ReturnType<typeof EmbedFactory.Create> {
  const lines = articles
    .map(FormatArticle)
    .filter((line): line is string => Boolean(line));

  return EmbedFactory.Create({
    title: heading,
    description:
      lines.length > 0
        ? lines.join("\n\n")
        : "No news articles were found. Try another query.",
    footer:
      lines.length > 0
        ? `Showing ${lines.length} article${lines.length === 1 ? "" : "s"}`
        : undefined,
  });
}

async function FetchTopHeadlines(
  apiKey: string,
  limit: number,
  country: string,
  category?: string | null
): Promise<NewsApiArticle[]> {
  const headers = { "User-Agent": "DiscordBotV3/NewsCommand" };
  const response = await RequestJson<NewsApiResponse>(
    `${apiConfig.news.url}/top-headlines`,
    {
      query: {
        apiKey,
        country,
        category: category ?? undefined,
        pageSize: limit,
      },
      headers,
      timeoutMs: apiConfig.news.timeoutMs,
    }
  );

  if (response.data?.status === "error") {
    throw new Error(response.data.message || "News API returned an error");
  }

  if (!response.ok || !response.data?.articles) {
    throw new Error(response.error ?? "Failed to fetch news");
  }

  return response.data.articles.slice(0, limit);
}

async function FetchSearchResults(
  apiKey: string,
  query: string,
  limit: number,
  sort: string
): Promise<NewsApiArticle[]> {
  const headers = { "User-Agent": "DiscordBotV3/NewsCommand" };
  const response = await RequestJson<NewsApiResponse>(
    `${apiConfig.news.url}/everything`,
    {
      query: {
        apiKey,
        q: query,
        pageSize: limit,
        sortBy: sort,
        language: "en",
      },
      headers,
      timeoutMs: apiConfig.news.timeoutMs,
    }
  );

  if (response.data?.status === "error") {
    throw new Error(response.data.message || "News API returned an error");
  }

  if (!response.ok || !response.data?.articles) {
    throw new Error(response.error ?? "Failed to fetch news");
  }

  return response.data.articles.slice(0, limit);
}

async function ExecuteNews(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const apiKey = RequireFeatureApiKey({
    feature: "news",
    context,
    commandName: "news",
  });
  if (!apiKey) {
    const embed = EmbedFactory.CreateError({
      title: "News Unavailable",
      description:
        "News functionality is not configured. Please ask the bot owner to set API_NEWS_KEY.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const limitInput = interaction.options.getInteger("limit");
  const limit = Math.min(Math.max(limitInput ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (subcommand === "top") {
    const country = interaction.options.getString("country") ?? "us";
    const category = interaction.options.getString("category");

    const articles = await FetchTopHeadlines(apiKey, limit, country, category);
    const embed = BuildNewsEmbed("🗞️ Top Headlines", articles);

    await interactionResponder.Reply(interaction, {
      embeds: [embed],
    });
    return;
  }

  const query = interaction.options.getString("query", true).trim();
  const sort = interaction.options.getString("sort") ?? "publishedAt";

  const articles = await FetchSearchResults(apiKey, query, limit, sort);
  const embed = BuildNewsEmbed(`🔎 News for "${query}"`, articles);

  await interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const NewsCommand = CreateCommand({
  name: "news",
  description: "Browse top headlines or search for news articles",
  group: "fun",
  config: Config.utility(3),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("top")
          .setDescription("Show top headlines")
          .addStringOption((option) =>
            option
              .setName("country")
              .setDescription("Country code (default: us)")
              .setRequired(false)
              .addChoices(
                { name: "United States", value: "us" },
                { name: "United Kingdom", value: "gb" },
                { name: "Canada", value: "ca" },
                { name: "Australia", value: "au" },
                { name: "India", value: "in" }
              )
          )
          .addStringOption((option) =>
            option
              .setName("category")
              .setDescription("News category filter")
              .setRequired(false)
              .addChoices(
                { name: "Business", value: "business" },
                { name: "Entertainment", value: "entertainment" },
                { name: "General", value: "general" },
                { name: "Health", value: "health" },
                { name: "Science", value: "science" },
                { name: "Sports", value: "sports" },
                { name: "Technology", value: "technology" }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName("limit")
              .setDescription("Number of articles (1-10)")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(MAX_LIMIT)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("search")
          .setDescription("Search for news articles")
          .addStringOption((option) =>
            option
              .setName("query")
              .setDescription("Keywords to search for")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("sort")
              .setDescription("Sort order")
              .setRequired(false)
              .addChoices(
                { name: "Published (newest)", value: "publishedAt" },
                { name: "Relevance", value: "relevancy" },
                { name: "Popularity", value: "popularity" }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName("limit")
              .setDescription("Number of articles (1-10)")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(MAX_LIMIT)
          )
      );
  },
  execute: ExecuteNews,
});

