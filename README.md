# 🤖 Discord Bot V3

A modern, scalable Discord bot framework built with TypeScript and Discord.js v14.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue.svg)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)

> ⚠️ **Early Development** – This framework is in active development. Features may change and breaking changes are possible.

## Table of contents

- [Quick Start](#quick-start)
- [Setup](#setup)
- [Features](#features)
- [Architecture](#architecture)
- [Examples](#examples)
- [Documentation](#documentation)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

```bash
git clone <repository_url>
cd discord-bot-v3
npm install
```

Create `.env` with `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` (copy from [.env.example](.env.example)). Then:

```bash
npm run dev
```

Get bot credentials at the [Discord Developer Portal](https://discord.com/developers/applications).

**Next:** [Developer Setup](docs/DEVELOPER_SETUP.md) · [Writing Commands](docs/WRITING_COMMANDS.md) · [Configuration](docs/CONFIGURATION.md) · [Contributing](docs/CONTRIBUTING.md)

## Setup

- **Prerequisites:** Node.js 16+, npm.
- **Install & run:** `npm install` → copy `.env.example` to `.env` and set required vars → `npm run dev`. Slash commands deploy to the guild in `GUILD_ID` on startup.
- **Before committing:** `npm run lint` and `npm run test`.

Full details: [Developer Setup](docs/DEVELOPER_SETUP.md) · [Configuration](docs/CONFIGURATION.md)

## Features

- TypeScript + Discord.js v14, slash commands with auto-deploy
- Middleware (logging, permissions, cooldowns)
- Interactive UI (pagination, buttons, embeds) and reusable utilities
- Structured logging and full type safety

## Architecture

Modular, layered flow: **Discord.js Client** → **Bot Layer** → **Command Loader & Registry** → **Middleware Chain** → **Command Handler** → **Responders**. Components include commands, events, utilities, and SQLite-backed persistence. [Writing Commands](docs/WRITING_COMMANDS.md) covers the command/middleware/responder pipeline in detail.

### Data flow (slash command)

1. User runs `/command` → interaction received
2. Middleware runs (before) → command executes → middleware runs (after)
3. Response sent to Discord

## Examples

Start with the **[Starter Template](examples/basic/starter-template.ts)** and copy it into `src/Commands/`.

| Level        | Examples                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beginner     | [Starter Template](examples/basic/starter-template.ts), [Ping](examples/basic/ping-command.ts), [Hello](examples/basic/hello-command.ts), [Ready Event](examples/events/ready-event.ts) |
| Intermediate | [Kick](examples/advanced/kick-command.ts), [Embeds](examples/utilities/embed-examples.ts), [Components](examples/utilities/component-examples.ts)                                       |
| Advanced     | [Help](examples/advanced/help-command.ts), [Guild Resources](examples/utilities/guild-resource-examples.ts)                                                                             |

[View all →](examples/)

## Documentation

- [Developer Setup](docs/DEVELOPER_SETUP.md) – Local setup, run modes, lint and test
- [Configuration](docs/CONFIGURATION.md) – Environment variables
- [Writing Commands](docs/WRITING_COMMANDS.md) – Command structure, middleware, responders
- [Contributing](docs/CONTRIBUTING.md) – Standards and PR process

### Writing your first command

```typescript
import { CreateCommand } from "@commands";
import { Config } from "@middleware";

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  config: Config.utility(5),
  execute: async (interaction, context) => {
    const { interactionResponder } = context.responders;
    await interactionResponder.Reply(interaction, {
      content: "Done!",
      ephemeral: true,
    });
  },
});
```

Full guide: [Writing Commands](docs/WRITING_COMMANDS.md)

## Scripts

`npm run dev` · `npm run build` · `npm run test` · `npm run lint` · `npm run format` · `npm run clean`

Full list: [Developer Setup → Run modes](docs/DEVELOPER_SETUP.md#run-modes)

## Troubleshooting

| Issue                 | Fix                                  |
| --------------------- | ------------------------------------ |
| Command not appearing | Run `npm run dev` to deploy commands |
| Bot not responding    | Check `DISCORD_TOKEN` in `.env`      |
| TypeScript errors     | Run `npm run build` for details      |

More help: [examples](examples/) or open an issue.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for standards, tests, and how to submit changes.

## License

MIT – see [LICENSE](LICENSE).
