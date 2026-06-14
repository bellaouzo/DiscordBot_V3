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

Copy [.env.example](../.env.example) to `.env` and fill these in.

### Command deployment

| Variable               | Default  | Description                                                                 |
| ---------------------- | -------- | --------------------------------------------------------------------------- |
| `COMMAND_DEPLOY_SCOPE` | `global` | `global` registers commands in all guilds; `guild` deploys to one guild only |
| `GUILD_ID`             | (none)   | Required when `COMMAND_DEPLOY_SCOPE=guild` (recommended for local dev)      |

Global commands can take up to an hour to propagate on Discord. For instant iteration during development, set `COMMAND_DEPLOY_SCOPE=guild` and `GUILD_ID` to your test server.

### Guild setup and feature toggles

Run `/setup` in a guild to configure staff roles, channels, and per-guild feature modules in a 6-step wizard (welcome → staff → features → support/logging → community → review).

Feature toggles are stored in SQLite (`server.db`):

| Setting | Table / field | Effect |
| ------- | ------------- | ------ |
| Economy | `guild_settings.economy_enabled` | Blocks `/economy` and `/economyadmin` when off |
| Giveaways | `guild_settings.giveaways_enabled` | Blocks `/giveaway` when off |
| Leveling | `guild_xp_settings.enabled` | Disables chat XP awards when off |
| Starboard | `guild_settings.starboard_channel_id` | Cleared when starboard is turned off in setup |
| Verification | `guild_settings.verification_enabled` | Disables verification flows when off |

Both `economy_enabled` and `giveaways_enabled` default to `true` for existing guilds.

Commands that require per-guild feature toggles use `Config.utilityWithFeature("economy" | "giveaways")`, which adds `FeatureEnabledMiddleware` to the chain.

### Staff roles and first-time setup

Admin and mod commands check configured staff roles from `guild_settings`. Before setup has been run:

- Users with Discord **Administrator** or **Manage Server** permission can still use admin commands (including `/setup`).
- Everyone else sees a **Setup Required** message pointing them to someone with Administrator permission.

After setup, configured admin/mod roles apply. Discord administrators still bypass role checks via `IsAdmin` / `IsModerator` in `src/Utilities/StaffPermissions.ts`.

### Cooldown persistence

| Variable           | Default | Description |
| ------------------ | ------- | ----------- |
| `COOLDOWN_PERSIST` | (unset) | Set to `1` to persist command cooldowns in `server.db` across restarts |

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
| `DATA_DIR` | Directory used for SQLite files: `server.db`, `users.db`, `moderation.db`, and `tickets.db`. Defaults to `<project>/data`. |

## Config shape in code

`LoadAppConfig()` returns an `AppConfig` object with:

- **discord** – `{ token }`
- **deployment** – `{ clientId, guildId }`
- **logging** – channel/category names as above
- **apiKeys** – `{ openWeatherMapApiKey }`

Required fields are validated on load; missing or empty required env vars throw before the bot starts.
