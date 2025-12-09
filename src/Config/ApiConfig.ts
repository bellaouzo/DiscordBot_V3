import { config as loadEnv } from "dotenv";

interface EndpointConfig {
  readonly url: string;
  readonly timeoutMs: number;
}

interface ApodConfig extends EndpointConfig {
  readonly apiKey: string;
}

interface NewsConfig extends EndpointConfig {
  readonly apiKey: string;
}

export interface ApiConfig {
  readonly quote: EndpointConfig;
  readonly meme: EndpointConfig;
  readonly joke: EndpointConfig;
  readonly dadJoke: EndpointConfig;
  readonly fact: EndpointConfig;
  readonly trivia: EndpointConfig;
  readonly apod: ApodConfig;
  readonly news: NewsConfig;
}

const DEFAULTS: ApiConfig = {
  quote: { url: "https://zenquotes.io/api/random", timeoutMs: 6000 },
  meme: { url: "https://meme-api.com/gimme", timeoutMs: 5000 },
  joke: { url: "https://v2.jokeapi.dev/joke", timeoutMs: 6000 },
  dadJoke: { url: "https://icanhazdadjoke.com/", timeoutMs: 4000 },
  fact: { url: "https://uselessfacts.jsph.pl/random.json", timeoutMs: 5000 },
  trivia: { url: "https://opentdb.com/api.php", timeoutMs: 6000 },
  apod: {
    url: "https://api.nasa.gov/planetary/apod",
    timeoutMs: 8000,
    apiKey: "KuUCs835dtn1U03B930ggRRxNVoBE1mb00vXVYxF",
  },
  news: {
    url: "https://newsapi.org/v2",
    timeoutMs: 7000,
    apiKey: "797ad4f3fa334d5e968f59127c41e929",
  },
};

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureEnvLoaded(): void {
  // In case the main config hasn’t been initialized yet.
  loadEnv({ override: false });
}

export function LoadApiConfig(): ApiConfig {
  ensureEnvLoaded();

  return {
    quote: {
      url: process.env.API_QUOTE_URL || DEFAULTS.quote.url,
      timeoutMs: toNumber(
        process.env.API_QUOTE_TIMEOUT_MS,
        DEFAULTS.quote.timeoutMs
      ),
    },
    meme: {
      url: process.env.API_MEME_URL || DEFAULTS.meme.url,
      timeoutMs: toNumber(
        process.env.API_MEME_TIMEOUT_MS,
        DEFAULTS.meme.timeoutMs
      ),
    },
    joke: {
      url: process.env.API_JOKE_URL || DEFAULTS.joke.url,
      timeoutMs: toNumber(
        process.env.API_JOKE_TIMEOUT_MS,
        DEFAULTS.joke.timeoutMs
      ),
    },
    dadJoke: {
      url: process.env.API_DADJOKE_URL || DEFAULTS.dadJoke.url,
      timeoutMs: toNumber(
        process.env.API_DADJOKE_TIMEOUT_MS,
        DEFAULTS.dadJoke.timeoutMs
      ),
    },
    fact: {
      url: process.env.API_FACT_URL || DEFAULTS.fact.url,
      timeoutMs: toNumber(
        process.env.API_FACT_TIMEOUT_MS,
        DEFAULTS.fact.timeoutMs
      ),
    },
    trivia: {
      url: process.env.API_TRIVIA_URL || DEFAULTS.trivia.url,
      timeoutMs: toNumber(
        process.env.API_TRIVIA_TIMEOUT_MS,
        DEFAULTS.trivia.timeoutMs
      ),
    },
    apod: {
      url: process.env.API_APOD_URL || DEFAULTS.apod.url,
      timeoutMs: toNumber(
        process.env.API_APOD_TIMEOUT_MS,
        DEFAULTS.apod.timeoutMs
      ),
      apiKey: process.env.API_APOD_KEY || DEFAULTS.apod.apiKey,
    },
    news: {
      url: process.env.API_NEWS_URL || DEFAULTS.news.url,
      timeoutMs: toNumber(
        process.env.API_NEWS_TIMEOUT_MS,
        DEFAULTS.news.timeoutMs
      ),
      apiKey: process.env.API_NEWS_KEY || DEFAULTS.news.apiKey,
    },
  };
}
