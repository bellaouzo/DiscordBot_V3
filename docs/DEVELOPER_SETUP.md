# Developer Setup

Step-by-step guide to get the Discord Bot V3 codebase running locally for development.

## Prerequisites

- **Node.js** 20 or higher
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

Optional for faster local command deploy:

- `COMMAND_DEPLOY_SCOPE=guild` and `GUILD_ID` – deploy slash commands instantly to one test server (enable Developer Mode in Discord, then right-click the server and copy ID)

Optional variables and defaults are documented in [CONFIGURATION.md](CONFIGURATION.md).

## 3. Run the bot

For day-to-day development (recommended):

```bash
npm run dev:watch
```

This runs TypeScript from source via `tsx` and reloads on save — no compile step required.

For a one-shot start from source:

```bash
npm run dev
```

To test the compiled production output locally:

```bash
npm run dev:watch:dist
```

Slash commands deploy on startup (`global` by default, or to `GUILD_ID` when `COMMAND_DEPLOY_SCOPE=guild`). If you see the bot online in Discord, setup is complete.

## 4. Git hooks

`npm install` runs the `prepare` script, which registers [Husky](https://typicode.github.io/husky/) hooks. A **pre-push** hook runs `npm run lint` automatically before every `git push`.

If hooks are missing after clone, run:

```bash
npm run prepare
```

## 5. Run lint and tests

Before committing, run:

```bash
npm run lint
npm run lint:examples
npm run format:check
npm run test
npm run test:coverage
npm run check:commands
```

- **Lint:** Runs `tsc --noEmit` and ESLint on `src/` and `tests/`.
- **Examples lint:** TypeScript + ESLint on `examples/` reference files.
- **Format check:** Verifies Prettier formatting without writing files.
- **Test:** Runs the Vitest test suite.
- **Coverage:** Runs tests with coverage gates (global floors: 65% lines / 55% branches).
- **Command check:** Verifies no duplicate top-level slash command names.

CI runs these on push/PR to `main`/`master`; see [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## Run modes

| Command                 | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm run dev`           | Run from TypeScript source via `tsx` (deploys slash commands on startup) |
| `npm start`             | Build to `dist/` then run compiled output                                |
| `npm run build`         | Compile TypeScript to `dist/` only                                       |
| `npm run test`          | Run Vitest once                                                          |
| `npm run test:watch`    | Run Vitest in watch mode                                                 |
| `npm run test:coverage` | Run tests with coverage report                                           |
| `npm run format`        | Format code with Prettier                                                |
| `npm run format:check`  | Check formatting without writing                                         |
| `npm run clean`         | Remove `dist/`                                                           |

## Next steps

- [Configuration reference](CONFIGURATION.md) – All env vars and defaults
- [Writing commands](WRITING_COMMANDS.md) – Command structure, middleware, responders
- [Contributing](CONTRIBUTING.md) – Coding standards and PR process
- [README](../README.md) – Architecture, examples, and quick start
