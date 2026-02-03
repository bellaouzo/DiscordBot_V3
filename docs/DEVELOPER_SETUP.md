# Developer Setup

Step-by-step guide to get the Discord Bot V3 codebase running locally for development.

## Prerequisites

- **Node.js** 16 or higher
- **npm** (comes with Node.js)

Check versions:

```bash
node -v
npm -v
```

## 1. Clone and install

```bash
git clone <repository_url>
cd discord-bot-v3
npm install
```

## 2. Environment configuration

Copy the example environment file and set your values:

```bash
cp .env.example .env
```

Edit `.env` and set the **required** variables:

- `DISCORD_TOKEN` – Bot token from the [Discord Developer Portal](https://discord.com/developers/applications) (Bot section)
- `CLIENT_ID` – Application ID (General Information)
- `GUILD_ID` – ID of the Discord server where you want to test (enable Developer Mode in Discord, then right-click the server and copy ID)

Optional variables and defaults are documented in [CONFIGURATION.md](CONFIGURATION.md).

## 3. Run the bot

```bash
npm run dev
```

This compiles TypeScript and starts the bot. Slash commands are deployed to the guild specified by `GUILD_ID` on startup. If you see the bot online in Discord, setup is complete.

## 4. Run lint and tests

Before committing, run:

```bash
npm run lint
npm run test
```

- **Lint:** Runs `tsc --noEmit` and ESLint on `src/` and `tests/`.
- **Test:** Runs the Vitest test suite.

CI runs these on push/PR to `main`; see [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## Run modes

| Command                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Compile and run the bot (deploys slash commands on startup) |
| `npm start`             | Same as `dev`: compile then run                             |
| `npm run build`         | Compile TypeScript to `dist/` only                          |
| `npm run test`          | Run Vitest once                                             |
| `npm run test:watch`    | Run Vitest in watch mode                                    |
| `npm run test:coverage` | Run tests with coverage report                              |
| `npm run format`        | Format code with Prettier                                   |
| `npm run format:check`  | Check formatting without writing                            |
| `npm run clean`         | Remove `dist/`                                              |

## Next steps

- [Configuration reference](CONFIGURATION.md) – All env vars and defaults
- [Writing commands](WRITING_COMMANDS.md) – Command structure, middleware, responders
- [Contributing](CONTRIBUTING.md) – Coding standards and PR process
- [README](../README.md) – Architecture, examples, and quick start
