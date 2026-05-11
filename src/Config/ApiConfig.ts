import { config as loadEnv } from "dotenv";

interface EndpointConfig {
  readonly url: string;
  readonly timeoutMs: number;
}

interface ApodConfig extends EndpointConfig {
  readonly apiKey: string | null;
}

interface NewsConfig extends EndpointConfig {
  readonly apiKey: string | null;
}

interface WeatherConfig extends EndpointConfig {
  readonly apiKey: string | null;
}

interface TranslateConfig extends EndpointConfig {
  readonly apiKey: string | null;
}

interface RobloxBridgeConfig extends EndpointConfig {
  readonly apiKey: string;
  readonly urlSigningSecret: string;
}

export type ApiFeatureWithRequiredKey =
  | "apod"
  | "news"
  | "weather"
  | "robloxBridge";

export interface ApiConfig {
  readonly quote: EndpointConfig;
  readonly meme: EndpointConfig;
  readonly joke: EndpointConfig;
  readonly dadJoke: EndpointConfig;
  readonly fact: EndpointConfig;
  readonly trivia: EndpointConfig;
  readonly apod: ApodConfig;
  readonly news: NewsConfig;
  readonly weather: WeatherConfig;
  readonly translate: TranslateConfig;
  readonly insult: EndpointConfig;
  readonly robloxBridge: RobloxBridgeConfig;
}

const REQUIRED_FEATURE_ENV: Record<ApiFeatureWithRequiredKey, string> = {
  apod: "API_APOD_KEY",
  news: "API_NEWS_KEY",
  weather: "OPENWEATHER_API_KEY",
  robloxBridge: "ROBLOX_BRIDGE_API_KEY",
};

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
    apiKey: null,
  },
  news: {
    url: "https://newsapi.org/v2",
    timeoutMs: 7000,
    apiKey: null,
  },
  weather: {
    url: "https://api.openweathermap.org/data/2.5",
    timeoutMs: 8000,
    apiKey: null,
  },
  translate: {
    url: "https://api.mymemory.translated.net",
    timeoutMs: 10000,
    apiKey: null,
  },
  insult: {
    url: "https://evilinsult.com/generate_insult.php",
    timeoutMs: 5000,
  },
  robloxBridge: {
    url: "",
    timeoutMs: 8000,
    apiKey: "",
    urlSigningSecret: "",
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
      apiKey: process.env.API_APOD_KEY?.trim() || DEFAULTS.apod.apiKey,
    },
    news: {
      url: process.env.API_NEWS_URL || DEFAULTS.news.url,
      timeoutMs: toNumber(
        process.env.API_NEWS_TIMEOUT_MS,
        DEFAULTS.news.timeoutMs
      ),
      apiKey: process.env.API_NEWS_KEY?.trim() || DEFAULTS.news.apiKey,
    },
    weather: {
      url: process.env.API_WEATHER_URL || DEFAULTS.weather.url,
      timeoutMs: toNumber(
        process.env.API_WEATHER_TIMEOUT_MS,
        DEFAULTS.weather.timeoutMs
      ),
      apiKey: process.env.OPENWEATHER_API_KEY || DEFAULTS.weather.apiKey,
    },
    translate: {
      url: process.env.API_TRANSLATE_URL || DEFAULTS.translate.url,
      timeoutMs: toNumber(
        process.env.API_TRANSLATE_TIMEOUT_MS,
        DEFAULTS.translate.timeoutMs
      ),
      apiKey: process.env.API_TRANSLATE_KEY || DEFAULTS.translate.apiKey,
    },
    insult: {
      url: process.env.API_INSULT_URL || DEFAULTS.insult.url,
      timeoutMs: toNumber(
        process.env.API_INSULT_TIMEOUT_MS,
        DEFAULTS.insult.timeoutMs
      ),
    },
    robloxBridge: {
      url: process.env.ROBLOX_BRIDGE_API_URL || DEFAULTS.robloxBridge.url,
      timeoutMs: toNumber(
        process.env.API_ROBLOX_BRIDGE_TIMEOUT_MS,
        DEFAULTS.robloxBridge.timeoutMs
      ),
      apiKey: process.env.ROBLOX_BRIDGE_API_KEY || DEFAULTS.robloxBridge.apiKey,
      urlSigningSecret:
        process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET ||
        DEFAULTS.robloxBridge.urlSigningSecret,
    },
  };
}

export function GetRequiredFeatureApiKey(
  feature: ApiFeatureWithRequiredKey,
  config: ApiConfig = LoadApiConfig()
): {
  readonly apiKey: string | null;
  readonly envVar: string;
  readonly configured: boolean;
} {
  const envVar = REQUIRED_FEATURE_ENV[feature];

  if (feature === "weather") {
    const apiKey = config.weather.apiKey?.trim() || null;
    return { apiKey, envVar, configured: Boolean(apiKey) };
  }

  if (feature === "apod") {
    const apiKey = config.apod.apiKey?.trim() || null;
    return { apiKey, envVar, configured: Boolean(apiKey) };
  }

  if (feature === "news") {
    const apiKey = config.news.apiKey?.trim() || null;
    return { apiKey, envVar, configured: Boolean(apiKey) };
  }

  const apiKey = config.robloxBridge.apiKey.trim();
  return { apiKey: apiKey || null, envVar, configured: apiKey.length > 0 };
}

export function ListMissingRequiredFeatureApiKeys(
  config: ApiConfig = LoadApiConfig()
): Array<{ readonly feature: ApiFeatureWithRequiredKey; readonly envVar: string }> {
  const features: ApiFeatureWithRequiredKey[] = [
    "apod",
    "news",
    "weather",
    "robloxBridge",
  ];

  return features
    .map((feature) => ({ feature, result: GetRequiredFeatureApiKey(feature, config) }))
    .filter(({ result }) => !result.configured)
    .map(({ feature, result }) => ({ feature, envVar: result.envVar }));
}

export interface StrictStartupViolation {
  readonly message: string;
}

export function StrictFeatureKeysEnabled(): boolean {
  ensureEnvLoaded();
  const raw = process.env.BOT_STRICT_FEATURE_KEYS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function ListStrictStartupFeatureViolations(
  config: ApiConfig = LoadApiConfig()
): StrictStartupViolation[] {
  const violations: StrictStartupViolation[] = [];
  for (const entry of ListMissingRequiredFeatureApiKeys(config)) {
    violations.push({
      message: `Missing optional feature key: set ${entry.envVar} (${entry.feature})`,
    });
  }

  const bridgeUrl = config.robloxBridge.url.trim();
  if (bridgeUrl.length > 0) {
    const signingSecret = config.robloxBridge.urlSigningSecret.trim();
    if (signingSecret.length === 0) {
      violations.push({
        message:
          "ROBLOX_BRIDGE_API_URL is set; set ROBLOX_BRIDGE_URL_SIGNING_SECRET",
      });
    }
  }

  return violations;
}
