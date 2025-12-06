import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";

interface FactResponse {
  readonly text?: string;
  readonly fact?: string;
  readonly source?: string;
  readonly source_url?: string;
}

function GetFactText(payload?: FactResponse): {
  text?: string;
  source?: string;
} {
  if (!payload) {
    return {};
  }
  return {
    text: payload.text ?? payload.fact,
    source: payload.source_url ?? payload.source,
  };
}

async function ExecuteFact(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const response = await RequestJson<FactResponse>(
    "https://uselessfacts.jsph.pl/random.json",
    {
      query: { language: "en" },
      timeoutMs: 5000,
    }
  );

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? "Fact API request failed");
  }

  const fact = GetFactText(response.data);
  if (!fact.text) {
    throw new Error("The fact service returned an empty response");
  }

  const embed = EmbedFactory.Create({
    title: "📘 Random Fact",
    description: fact.text,
    footer: fact.source ? `Source: ${fact.source}` : undefined,
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed],
  });
}

export const FactCommand = CreateCommand({
  name: "fact",
  description: "Get a random fact",
  group: "fun",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  execute: ExecuteFact,
});
