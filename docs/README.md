# Documentation

Central index for Discord Bot V3 documentation. Pick the path that matches what you are trying to do.

## Start here

| I want to… | Start here |
|------------|------------|
| **Configure my Discord server** (roles, features, channels) | [Server Setup Guide](SERVER_SETUP.md) |
| **Run or deploy the bot** (install, `.env`, local dev) | [Developer Setup](DEVELOPER_SETUP.md) → [Environment Variables](ENVIRONMENT.md) |
| **Write or change bot code** | [Contributing](CONTRIBUTING.md) → [Writing Commands](WRITING_COMMANDS.md) |

## Suggested reading orders

### Server admin

1. [Server Setup Guide](SERVER_SETUP.md) — run `/setup` and configure your guild
2. [Commands Reference](COMMANDS.md) — slash commands available to members and staff
3. [Guild Configuration](CONFIGURATION.md) — how settings are stored and what toggles do

### Developer / deployer

1. [Developer Setup](DEVELOPER_SETUP.md) — clone, install, run locally
2. [Environment Variables](ENVIRONMENT.md) — tokens, API keys, deployment options
3. [Architecture Map](ARCHITECTURE_MAP.md) — where code lives and how requests flow

### Contributor

1. [Contributing](CONTRIBUTING.md) — standards and project structure
2. [Quality Checklist](QUALITY_CHECKLIST.md) — what must pass before a PR
3. [Writing Commands](WRITING_COMMANDS.md) — commands, middleware, responders
4. [Testing Strategy](TESTING_STRATEGY.md) — what and how to test

## Full doc index

| Document | Audience | Description |
|----------|----------|-------------|
| [SERVER_SETUP.md](SERVER_SETUP.md) | Admin | Plain-language `/setup` wizard guide |
| [COMMANDS.md](COMMANDS.md) | Admin | User-facing slash command reference |
| [CONFIGURATION.md](CONFIGURATION.md) | Admin, Dev | Per-guild settings and feature toggles |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Dev | `.env` variables, API keys, deployment |
| [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) | Dev | Local install, run modes, git hooks |
| [WRITING_COMMANDS.md](WRITING_COMMANDS.md) | Contributor | Command structure, middleware, responders |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor | Coding standards, migrations, PR process |
| [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) | Contributor | Pre-PR and CI quality gates |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Contributor | Test layout and coverage expectations |
| [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md) | Contributor, Maintainer | Runtime boundaries and domain maps |
| [MODULE_OWNERSHIP.md](MODULE_OWNERSHIP.md) | Maintainer | Feature ownership and change rules |
| [STABILITY.md](STABILITY.md) | Maintainer | Semver policy and deprecation process |

## See also

- [Project README](../README.md) — overview, quick start, and feature summary
- [Examples](../examples/) — copy-paste command templates
- [Changelog](../CHANGELOG.md) — release history
