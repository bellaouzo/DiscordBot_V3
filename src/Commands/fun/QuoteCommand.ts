import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";

interface QuoteResponse {
  readonly q?: string; // quote text
  readonly a?: string; // author
}

interface Quote {
  readonly text: string;
  readonly author?: string;
}

async function FetchRandomQuote(): Promise<Quote> {
  const response = await RequestJson<QuoteResponse[]>(
    "https://zenquotes.io/api/random",
    {
      timeoutMs: 6000,
    }
  );

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
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  execute: ExecuteQuote,
});
