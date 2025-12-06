import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CooldownMiddleware } from "@middleware/CooldownMiddleware";
import { Config } from "@middleware/CommandConfig";
import { EmbedFactory } from "@utilities";
import { RequestJson } from "@utilities/ApiClient";
import { LoadApiConfig } from "@config/ApiConfig";

type TriviaDifficulty = "easy" | "medium" | "hard";

interface TriviaQuestion {
  readonly category: string;
  readonly type: "multiple";
  readonly difficulty: TriviaDifficulty;
  readonly question: string;
  readonly correct_answer: string;
  readonly incorrect_answers: string[];
}

interface TriviaResponse {
  readonly response_code: number;
  readonly results: TriviaQuestion[];
}

const apiConfig = LoadApiConfig();

function Shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function BuildTriviaQuery(options: {
  readonly category?: number | null;
  readonly difficulty?: TriviaDifficulty | null;
}): Record<string, string | number> {
  const query: Record<string, string | number> = {
    amount: 1,
    type: "multiple",
    encode: "url3986",
  };

  if (options.category) {
    query.category = options.category;
  }

  if (options.difficulty) {
    query.difficulty = options.difficulty;
  }

  return query;
}

function FormatTrivia(question: TriviaQuestion): {
  title: string;
  description: string;
  footer: string;
} {
  const decodedQuestion = Decode(question.question);
  const decodedCorrect = Decode(question.correct_answer);
  const choices = Shuffle([
    decodedCorrect,
    ...question.incorrect_answers.map(Decode),
  ]);

  const lines = choices.map((choice, index) => {
    const label = String.fromCharCode(65 + index);
    return `${label}. ${choice}`;
  });

  return {
    title: `🧠 Trivia — ${Decode(question.category)}`,
    description: `${decodedQuestion}\n\n${lines.join("\n")}\n\nAnswer: ||${decodedCorrect}||`,
    footer: `Difficulty: ${question.difficulty}`,
  };
}

async function ExecuteTrivia(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const category = interaction.options.getInteger("category");
  const difficulty = interaction.options.getString(
    "difficulty"
  ) as TriviaDifficulty | null;

  const response = await RequestJson<TriviaResponse>(apiConfig.trivia.url, {
    query: BuildTriviaQuery({ category, difficulty }),
    timeoutMs: apiConfig.trivia.timeoutMs,
  });

  if (!response.ok || !response.data || response.data.response_code !== 0) {
    await interactionResponder.Reply(interaction, {
      content: "Could not fetch a trivia question right now. Try again later.",
      ephemeral: true,
    });
    return;
  }

  const question = response.data.results.at(0);
  if (!question) {
    await interactionResponder.Reply(interaction, {
      content: "Trivia service returned no questions. Please try again.",
      ephemeral: true,
    });
    return;
  }

  const formatted = FormatTrivia(question);
  const embed = EmbedFactory.Create({
    title: formatted.title,
    description: formatted.description,
    footer: formatted.footer,
  });

  await interactionResponder.Reply(interaction, { embeds: [embed] });
}

export const TriviaCommand = CreateCommand({
  name: "trivia",
  description: "Get a random multiple-choice trivia question",
  group: "fun",
  middleware: {
    before: [LoggingMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.utility(5),
  configure: (builder) => {
    builder
      .addIntegerOption((option) =>
        option
          .setName("category")
          .setDescription("OpenTDB category ID (e.g., 18 = Computers)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("difficulty")
          .setDescription("Difficulty for the question")
          .setRequired(false)
          .addChoices(
            { name: "Easy", value: "easy" },
            { name: "Medium", value: "medium" },
            { name: "Hard", value: "hard" }
          )
      );
  },
  execute: ExecuteTrivia,
});
