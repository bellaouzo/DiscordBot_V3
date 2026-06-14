# Environment Variables

Environment variables for **running and deploying** the bot. For configuring a Discord server inside Discord, see [Server Setup Guide](SERVER_SETUP.md).

The app loads `.env` from the project root at startup. Override the path with `APP_ENV_PATH`.

Source of truth: [src/Config/AppConfig.ts](../src/Config/AppConfig.ts) and [src/Config/ApiConfig.ts](../src/Config/ApiConfig.ts).

## Quick setup

Copy the example file and set required values:

```bash
# macOS / Linux
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

Edit `.env` and set:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token (Developer Portal → Bot) |
| `CLIENT_ID` | Application ID (General Information) |

## Required variables

These must be set or the process throws at startup.

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application client ID |

## Command deployment

| Variable | Default | Description |
|----------|---------|-------------|
| `COMMAND_DEPLOY_SCOPE` | `global` | `global` = all guilds; `guild` = one test server |
| `GUILD_ID` | (none) | Required when `COMMAND_DEPLOY_SCOPE=guild` |

Global commands can take up to an hour to propagate. For local dev, use `guild` scope and your test server ID.

## Optional — runtime and data

| Variable | Default | Description |
|----------|---------|-------------|
| `COOLDOWN_PERSIST` | (unset) | Set `1` to persist command cooldowns in `server.db` across restarts |
| `DATA_DIR` | `<project>/data` | SQLite files: `server.db`, `users.db`, `moderation.db`, `tickets.db` |
| `APP_ENV_PATH` | (none) | Absolute path to a `.env` file |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |

## Optional — logging channel names

Defaults used when setup creates or resolves log channels:

| Variable | Default |
|----------|---------|
| `COMMAND_LOG_CHANNEL_NAME` | `command-logs` |
| `COMMAND_LOG_CATEGORY_NAME` | `Bot Logs` |
| `MESSAGE_DELETE_LOG_CHANNEL_NAME` | `deleted-logs` |
| `DEPLOY_LOG_CHANNEL_NAME` | `deployment-logs` |

## Optional — API keys

| Variable | Required by |
|----------|-------------|
| `OPENWEATHER_API_KEY` | `/weather` |
| `API_APOD_KEY` | `/apod` |
| `API_NEWS_KEY` | `/news` |
| `API_TRANSLATE_KEY` | Translation integrations |
| `ROBLOX_BRIDGE_API_KEY` | Roblox bridge actions |
| `ROBLOX_BRIDGE_URL_SIGNING_SECRET` | Roblox key setup URL signing |

If unset, dependent commands return user-safe "not configured" messages instead of crashing.

## Optional — API URLs and timeouts

Endpoints and timeouts can be overridden. Examples:

- `API_APOD_URL`, `API_APOD_TIMEOUT_MS`
- `API_NEWS_URL`, `API_NEWS_TIMEOUT_MS`
- `API_WEATHER_URL`, `API_WEATHER_TIMEOUT_MS`
- `API_QUOTE_URL`, `API_MEME_URL`, `API_JOKE_URL`, `API_DADJOKE_URL`
- `API_FACT_URL`, `API_TRIVIA_URL`, `API_TRANSLATE_URL`, `API_INSULT_URL`
- `ROBLOX_BRIDGE_API_URL`, `API_ROBLOX_BRIDGE_TIMEOUT_MS`

See [.env.example](../.env.example) for the full list.

## Strict optional-feature keys (fail-fast)

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_STRICT_FEATURE_KEYS` | (unset) | Set `1`, `true`, or `yes` to **throw at startup** if tracked API keys are missing, or if `ROBLOX_BRIDGE_API_URL` is set without `ROBLOX_BRIDGE_URL_SIGNING_SECRET`. Leave unset for local dev. |

## Secret hygiene

- Keep `.env.example` as placeholders only — never commit real secrets.
- Store secrets in `.env` (gitignored) or `APP_ENV_PATH`.
- When adding integrations, update `ApiConfig.ts`, `.env.example`, and this document.

## Config shape in code

`LoadAppConfig()` returns:

- **discord** — `{ token }`
- **deployment** — `{ clientId, guildId }`
- **logging** — channel/category name defaults
- **apiKeys** — `{ openWeatherMapApiKey }`

## See also

- [.env.example](../.env.example) — all variables with comments
- [Guild Configuration](CONFIGURATION.md) — per-server settings from `/setup`
- [Developer Setup](DEVELOPER_SETUP.md) — install and run locally
- [Documentation hub](README.md)
