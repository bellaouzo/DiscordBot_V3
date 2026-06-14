# Discord Bot V3

A modular Discord bot framework built with TypeScript and Discord.js v14 — slash commands, middleware, SQLite persistence, tickets, appeals, economy minigames, and more.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-20+-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)

> APIs are stabilizing; see [Changelog](CHANGELOG.md) for recent changes and [Stability policy](docs/STABILITY.md) for semver policy.

## Choose your path

| I want to… | Start here |
|------------|------------|
| **Configure my Discord server** | [Server Setup Guide](docs/SERVER_SETUP.md) · [Commands](docs/COMMANDS.md) |
| **Run or deploy the bot** | [Quick Start](#quick-start) → [Developer Setup](docs/DEVELOPER_SETUP.md) |
| **Build or contribute code** | [Documentation hub](docs/README.md) → [Writing Commands](docs/WRITING_COMMANDS.md) |

Full index: [Documentation hub](docs/README.md)

## Quick Start

1. **Clone and install**
   ```bash
   git clone <repository_url>
   cd discord-bot-v3
   npm install
   ```
2. **Create `.env`** — copy [.env.example](.env.example) and set `DISCORD_TOKEN` and `CLIENT_ID`.
3. **Run locally** — `npm run dev:watch` runs TypeScript directly with hot reload (no build step). Use `npm run dev:watch:dist` to test the compiled `dist/` output, or `npm start` for production.
4. **Invite the bot** — use the OAuth2 URL generator in the [Discord Developer Portal](https://discord.com/developers/applications) with `applications.commands` and required intents.
5. **Configure the server** — run `/setup` in your guild. See [Server Setup Guide](docs/SERVER_SETUP.md).

**Docs:** [Documentation hub](docs/README.md) · [Developer Setup](docs/DEVELOPER_SETUP.md) · [Server Setup](docs/SERVER_SETUP.md) · [Contributing](docs/CONTRIBUTING.md)

## What you get

| Group | Examples | Highlights |
|-------|----------|------------|
| **Moderation** | `/kick`, `/ban`, `/warn`, `/mute`, `/purge`, `/lockdown`, `/raidmode` | Temp actions, casefile, link filter, slowmode |
| **Appeals** | `/appeal submit`, `/appeal-admin list`, `/appeal-admin review` | Select → modal flow, staff review buttons |
| **Utility** | `/setup`, `/ticket`, `/giveaway`, `/poll`, `/event`, `/announcement`, `/help` | Setup wizard, ticket system, giveaways |
| **Fun** | `/profile`, `/rank`, `/leaderboard`, `/economy` | XP, coins, leaderboard pagination |
| **Economy** | `/economy balance`, `/economy blackjack`, `/economy crash` | Button-driven minigames with pure logic modules |
| **Roblox** | `/roblox kick`, `/roblox status` | Bridge API integration (optional) |

## Configuration at a glance

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot token from Developer Portal |
| `CLIENT_ID` | Yes | Application client ID |
| `COMMAND_DEPLOY_SCOPE` | No | `global` (default) or `guild` — where slash commands are registered |
| `GUILD_ID` | No | Required only when `COMMAND_DEPLOY_SCOPE=guild` (instant dev deploy) |
| `COOLDOWN_PERSIST` | No | Set `1` to persist command cooldowns across restarts |
| `OPENWEATHER_API_KEY` | No | Enables `/weather` |
| `ROBLOX_BRIDGE_API_URL` | No | Roblox bridge base URL |
| `DATA_DIR` | No | Override SQLite data directory |

Full list: [.env.example](.env.example) · [Environment Variables](docs/ENVIRONMENT.md) · [Guild settings](docs/CONFIGURATION.md)

## Architecture (short)

**Discord.js Client** → **Bot** → **Command loader** → **Middleware** → **Command handler** → **Responders** → **Database / Systems**

Multi-step flows (appeals, setup, economy bets, tickets) register handlers on `ComponentRouter`, `SelectMenuRouter`, and `ModalRouter` so each interaction step stays typed and testable.

Deep dive: [Architecture map](docs/ARCHITECTURE_MAP.md)

## Development

```bash
npm run lint          # TypeScript + ESLint
npm test              # Vitest unit tests
npm run test:coverage # Coverage report + threshold gates
npm run format        # Prettier
```

`npm install` registers a **pre-push** git hook (Husky) that runs `npm run lint` before every push.

Before opening a PR, see [Quality Checklist](docs/QUALITY_CHECKLIST.md). CI also runs `npm audit --audit-level=high` (fails on high/critical advisories).

- [Writing Commands](docs/WRITING_COMMANDS.md) — `CreateCommand`, `Config` (auto middleware), responders
- [Contributing](docs/CONTRIBUTING.md) — standards, audit policy, PR process
- [Testing Strategy](docs/TESTING_STRATEGY.md) — behavior vs smoke tests

### Minimal command example

```typescript
import { CreateCommand } from "@commands";
import { Config } from "@middleware";

export const PingCommand = CreateCommand({
  name: "ping",
  description: "Check bot latency",
  group: "utility",
  config: Config.utility(1),
  execute: async (interaction, { responders }) => {
    await responders.interactionResponder.Reply(interaction, {
      content: `Pong! ${Date.now() - interaction.createdTimestamp}ms`,
      ephemeral: true,
    });
  },
});
```

## Deploy

Production-style start (pull, build, PM2):

```bash
npm run vps:start
```

See [Developer setup](docs/DEVELOPER_SETUP.md) for run modes. Environment variables: [Environment variables](docs/ENVIRONMENT.md).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Commands not appearing | Run `npm run dev:watch` to redeploy; for faster local iteration set `COMMAND_DEPLOY_SCOPE=guild` and `GUILD_ID` |
| Bot not responding | Verify `DISCORD_TOKEN`; check intents in Developer Portal |
| Permission errors (in Discord) | See [Server Setup Guide](docs/SERVER_SETUP.md#troubleshooting) |
| SQLite errors | Ensure `DATA_DIR` is writable |
| CI audit failure | Run `npm audit`; upgrade or patch vulnerable dependencies |
| Coverage gate failure | Run `npm run test:coverage` locally; add behavior tests for uncovered flows |

## Examples

| Level | Examples |
|-------|----------|
| Beginner | [Starter Template](examples/basic/starter-template.ts), [Ping](examples/basic/ping-command.ts) |
| Intermediate | [Kick](examples/advanced/kick-command.ts), [Embeds](examples/utilities/embed-examples.ts) |
| Advanced | [Help](examples/advanced/help-command.ts), [Guild Resources](examples/utilities/guild-resource-examples.ts) |

[View all examples →](examples/)

## License

MIT — see [LICENSE](LICENSE).
