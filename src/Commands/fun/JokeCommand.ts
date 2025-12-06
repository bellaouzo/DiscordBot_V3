import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";

type JokeType = "single" | "twopart";

interface JokeApiResponse {
  readonly type?: JokeType;
  readonly joke?: string;
  readonly setup?: string;
  readonly delivery?: string;
}

interface DadJokeResponse {
  readonly joke?: string;
}

interface Joke {
  readonly text: string;
  readonly title?: string;
}

function BuildJokeUrl(category?: string | null): string {
  const base = "https://v2.jokeapi.dev/joke";
  const chosen =
    category && category.trim().length > 0 ? category.trim() : "Any";
  const params = new URLSearchParams({
    "safe-mode": "true",
  });
  return `${base}/${encodeURIComponent(chosen)}?${params.toString()}`;
}

function FormatJokeFromJokeApi(payload: JokeApiResponse): Joke | null {
  if (payload.type === "single" && payload.joke) {
    return {
      title: "😂 Joke",
      text: payload.joke,
    };
  }

  if (payload.type === "twopart" && payload.setup && payload.delivery) {
    return {
      title: "😂 Joke",
      text: `${payload.setup}\n\n||${payload.delivery}||`,
    };
  }

  return null;
}

function FormatJokeFromDadJoke(payload: DadJokeResponse): Joke | null {
  if (payload.joke && payload.joke.trim().length > 0) {
    return {
      title: "😂 Joke",
      text: payload.joke.trim(),
    };
  }
  return null;
}

async function FetchJoke(
  logger: CommandContext["logger"],
  category?: string | null
): Promise<Joke> {
  // Primary: JokeAPI
  const primary = await RequestJson<JokeApiResponse>(BuildJokeUrl(category), {
    timeoutMs: 6000,
  });

  if (primary.ok && primary.data) {
    const joke = FormatJokeFromJokeApi(primary.data);
    if (joke) {
      return joke;
    }
  } else if (!primary.ok && primary.error) {
    logger.Warn("JokeAPI request failed", { error: primary.error });
  }

  // Secondary: icanhazdadjoke
  const secondary = await RequestJson<DadJokeResponse>(
    "https://icanhazdadjoke.com/",
    {
      headers: { Accept: "application/json" },
      timeoutMs: 4000,
    }
  );

  if (secondary.ok && secondary.data) {
    const joke = FormatJokeFromDadJoke(secondary.data);
    if (joke) {
      return joke;
    }
  } else if (!secondary.ok && secondary.error) {
    logger.Warn("DadJoke request failed", { error: secondary.error });
  }

  throw new Error("No joke sources are currently available");
}

async function ExecuteJoke(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const category = interaction.options.getString("category");

  const joke = await FetchJoke(context.logger, category);

  const embed = EmbedFactory.Create({
    title: joke.title ?? "😂 Joke",
    description: joke.text,
  });

  await interactionResponder.Reply(interaction, { embeds: [embed] });
}

export const JokeCommand = CreateCommand({
  name: "joke",
  description: "Grab a random joke",
  group: "fun",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(3),
  configure: (builder) => {
    builder.addStringOption((option) =>
      option
        .setName("category")
        .setDescription(
          "Pick a category (Any, Programming, Misc, Pun, Spooky, Christmas)"
        )
        .setRequired(false)
    );
  },
  execute: ExecuteJoke,
});
