# Configuration

Environment variables and how they map into the application config. The app loads `.env` from the project root at startup; you can override the path with `APP_ENV_PATH`.

Source of truth for loading and validation: [src/Config/AppConfig.ts](../src/Config/AppConfig.ts).
API feature key requirements live in [src/Config/ApiConfig.ts](../src/Config/ApiConfig.ts).

## Required variables

These must be set or the process will throw at startup.

| Variable        | Description                                            |
| --------------- | ------------------------------------------------------ |
| `DISCORD_TOKEN` | Discord bot token (from Developer Portal → Bot)        |
| `CLIENT_ID`     | Discord application ID (General Information)           |
| `GUILD_ID`      | Discord server (guild) ID for slash command deployment |

Copy [.env.example](../.env.example) to `.env` and fill these in.

## Optional variables

### Logging channel names

Used when creating or resolving log channels (e.g. command logs, deployment logs). Defaults are used if unset.

| Variable                          | Default           | Description                          |
| --------------------------------- | ----------------- | ------------------------------------ |
| `COMMAND_LOG_CHANNEL_NAME`        | `command-logs`    | Channel name for command logs        |
| `COMMAND_LOG_CATEGORY_NAME`       | `Bot Logs`        | Category name for bot log channels   |
| `MESSAGE_DELETE_LOG_CHANNEL_NAME` | `deleted-logs`    | Channel for message-delete logs      |
| `DEPLOY_LOG_CHANNEL_NAME`         | `deployment-logs` | Channel for deployment notifications |

### API keys

| Variable              | Default | Description                                                                                                                 |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `OPENWEATHER_API_KEY` | (none)  | OpenWeatherMap API key for the `/weather` command. Get a key at [openweathermap.org/api](https://openweathermap.org/api). |
| `API_APOD_KEY`        | (none)  | NASA API key for `/apod`.                                                                                                  |
| `API_NEWS_KEY`        | (none)  | NewsAPI key for `/news` commands.                                                                                          |
| `API_TRANSLATE_KEY`   | (none)  | Optional key for translation provider integrations.                                                                         |
| `ROBLOX_BRIDGE_API_KEY` | (none) | Shared API key used by Roblox bridge integration.                                                                           |
| `ROBLOX_BRIDGE_URL_SIGNING_SECRET` | (none) | Secret used to sign Roblox key setup URLs.                                                                                 |

If these values are unset, dependent features are unavailable and return user-safe configuration errors instead of exposing internal details.

### Required for specific feature sets

These are optional for startup, but required by the listed commands/features:

| Variable                           | Required by               |
| ---------------------------------- | ------------------------- |
| `API_APOD_KEY`                     | `/apod`                   |
| `API_NEWS_KEY`                     | `/news`                   |
| `OPENWEATHER_API_KEY`              | `/weather`                |
| `ROBLOX_BRIDGE_API_KEY`            | Roblox bridge actions     |
| `ROBLOX_BRIDGE_URL_SIGNING_SECRET` | Roblox key setup signing  |

Missing feature credentials are now detected centrally and logged at startup, and command handlers return safe user-facing configuration messages.

### Strict optional-feature keys (fail-fast)

| Variable                  | Default | Description                                                                                                                                                                                                 |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOT_STRICT_FEATURE_KEYS` | (unset) | When set to `1`, `true`, or `yes`, startup **throws** if any tracked optional-feature API key is missing (`API_APOD_KEY`, `API_NEWS_KEY`, `OPENWEATHER_API_KEY`, `ROBLOX_BRIDGE_API_KEY`), or if `ROBLOX_BRIDGE_API_URL` is non-empty but `ROBLOX_BRIDGE_URL_SIGNING_SECRET` is unset. Leave unset for local development without every integration. |

### Secret hygiene guardrails

- Keep `.env.example` placeholders only; never insert real secrets there.
- Keep real secrets in `.env` (ignored by git) or a local `APP_ENV_PATH` target.
- When adding new API integrations, update all of:
  - `src/Config/ApiConfig.ts`
  - `.env.example`
  - this document (`docs/CONFIGURATION.md`)

### API URLs and timeouts

All endpoints and request timeouts can be overridden with environment variables.

Examples:

- `API_APOD_URL`, `API_APOD_TIMEOUT_MS`
- `API_NEWS_URL`, `API_NEWS_TIMEOUT_MS`
- `API_WEATHER_URL`, `API_WEATHER_TIMEOUT_MS`
- `API_QUOTE_URL`, `API_MEME_URL`, `API_JOKE_URL`, `API_DADJOKE_URL`
- `API_FACT_URL`, `API_TRIVIA_URL`, `API_TRANSLATE_URL`, `API_INSULT_URL`
- `ROBLOX_BRIDGE_API_URL`, `API_ROBLOX_BRIDGE_TIMEOUT_MS`

### Environment file path

| Variable       | Description                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV_PATH` | Absolute path to a `.env` file. If set, only this file is loaded; otherwise the app looks for `.env` in the project root and a couple of fallback locations. |

### Data directory

| Variable   | Description |
| ---------- | ----------- |
| `DATA_DIR` | Absolute or relative directory used for SQLite files (for example `moderation.db`, `users.db`, and other runtime data). Defaults to `<project>/data`. |

## Config shape in code

`LoadAppConfig()` returns an `AppConfig` object with:

- **discord** – `{ token }`
- **deployment** – `{ clientId, guildId }`
- **logging** – channel/category names as above
- **apiKeys** – `{ openWeatherMapApiKey }`

Required fields are validated on load; missing or empty required env vars throw before the bot starts.
