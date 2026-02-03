# Configuration

Environment variables and how they map into the application config. The app loads `.env` from the project root at startup; you can override the path with `APP_ENV_PATH`.

Source of truth for loading and validation: [src/Config/AppConfig.ts](../src/Config/AppConfig.ts).

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

| Variable              | Default | Description                                                                                                               |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `OPENWEATHER_API_KEY` | (none)  | OpenWeatherMap API key for the `/weather` command. Get a key at [openweathermap.org/api](https://openweathermap.org/api). |

If not set, weather-related features may be disabled or return errors.

### Environment file path

| Variable       | Description                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV_PATH` | Absolute path to a `.env` file. If set, only this file is loaded; otherwise the app looks for `.env` in the project root and a couple of fallback locations. |

## Config shape in code

`LoadAppConfig()` returns an `AppConfig` object with:

- **discord** – `{ token }`
- **deployment** – `{ clientId, guildId }`
- **logging** – channel/category names as above
- **apiKeys** – `{ openWeatherMapApiKey }`

Required fields are validated on load; missing or empty required env vars throw before the bot starts.
