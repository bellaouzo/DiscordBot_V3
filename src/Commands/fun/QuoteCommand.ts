import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

interface QuoteResponse {
  readonly q?: string; // quote text
  readonly a?: string; // author
}

interface Quote {
  readonly text: string;
  readonly author?: string;
}

const apiConfig = LoadApiConfig();

async function FetchRandomQuote(): Promise<Quote> {
  const response = await RequestJson<QuoteResponse[]>(apiConfig.quote.url, {
    timeoutMs: apiConfig.quote.timeoutMs,
  });

  if (!response.ok || !response.data || response.data.length === 0) {
    throw new Error(response.error ?? "Quote API request failed");
  }

  const first = response.data[0];
  const text = first?.q?.trim();

  if (!text) {
    throw new Error("Quote API returned empty data");
  }

  return {
    text,
    author: first.a?.trim(),
  };
}

async function ExecuteQuote(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const quote = await FetchRandomQuote();

  const embed = EmbedFactory.Create({
    title: "🎲 Random Quote",
    description: `"${quote.text}"`,
    footer: quote.author ? `— ${quote.author}` : "Unknown author",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed],
    ephemeral: false,
  });
}

export const QuoteCommand = CreateCommand({
  name: "quote",
  description: "Get a random inspirational quote",
  group: "fun",
  config: Config.utility(3),
  execute: ExecuteQuote,
});

