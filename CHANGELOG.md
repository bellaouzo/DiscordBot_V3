# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- SQLite migration runner (`src/Database/Migrations/`) with server and ticket migration arrays; applied automatically on database startup.
- Setup wizard refactor: step modules, feature toggle handlers, draft persistence (`SaveSetupDraft`, `SyncDraftFromSavedSettings`).
- `FeatureEnabledMiddleware` and `@shared/GuildFeatures` for per-guild economy/giveaway gates.
- `MessageCreate` handler split (`ChatXpHandler`, `LinkFilterHandler`, `TicketMessageHandler`, `RunMessageCreateHandlers`).
- Husky pre-push hook (`.husky/pre-push`) runs `npm run lint` before every `git push`.
- `src/Bootstrap/SystemRegistry.ts` for bootstrap-wide button/select/modal handler registration.
- Shared infrastructure tests: `ApiClient`, `ModalRouter`, `ComponentRouter`, `Paginator`, `PaginatedResponder`.
- Roblox bridge handler tests (connect, disconnect, status, kick, group audit/info, `bridgeApi`, `bridgeAccess`, `bridgeSettings`).
- Appeal submit modal lifecycle tests; extended appeal panel and `AppealShared` coverage.
- `ChannelManager`, `CommandLogStore`, `AppealManager`, router, and consolidated branch-coverage suite (`tests/coverage/branchGateBoost.test.ts`).
- `CreateCommandDeployer` and `DiscordLogger` tests.
- Dependabot weekly npm updates (`.github/dependabot.yml`).
- Release workflow on `v*` tags (`.github/workflows/release.yml`).
- `npm run version:check` script and [STABILITY.md](docs/STABILITY.md) semver policy.
- `RequireGuild`, `RequireGuildFromInteraction`, and `RequireDefined` utilities for safe guild/value access.
- Command loader integration test (`tests/bot/CreateCommandLoader.test.ts`).
- Event loader, interaction-handler, and `CreateBot` tests under `tests/bot/`.
- Bootstrap smoke test (`tests/bootstrap.smoke.test.ts`) including event registration.
- Scheduler tests for giveaway, temp-action, and raid-mode sweeps.
- Ticket button lifecycle tests (claim, add user, remove user) and registry coverage.
- Appeal panel lifecycle test and appeal list pagination coverage.
- Error middleware and interaction responder test coverage.
- Static duplicate command name check (`npm run check:commands`).
- Examples typecheck + lint in CI (`npm run lint:examples`).

### Changed

- Permission middleware allows Discord **Administrator** / **Manage Server** holders to run admin commands before staff roles are configured; others see **Setup Required**.
- Removed duplicate `HelpCommand` re-export barrel; help command loads from `Utility/Help/HelpCommand.ts` only.
- Hardened command loader to skip re-export-only `*Command.ts` barrels.
- Standardized imports to path aliases (`@commands`, `@utilities`, etc.); `CommandFactory` uses aliases internally.
- Removed unused `CommandConfig.custom` escape hatch.
- Removed economy handler ESLint non-null assertion override; inventory item access uses guarded conditions.
- Raised global coverage gates to **65% lines / 55% branches** (statements 65%, functions 68%).
- Per-module coverage thresholds for `ApiClient`, routers, `Bootstrap`, and Roblox handlers.
- Economy handler branch coverage gate raised to **40%**; appeal flows to **35%**.
- Examples `tsconfig.json` enables `noUnusedLocals`.

### Documentation

- Documentation UX overhaul: [docs/README.md](docs/README.md) hub, [SERVER_SETUP.md](docs/SERVER_SETUP.md) admin guide, [ENVIRONMENT.md](docs/ENVIRONMENT.md) split from guild config, [QUALITY_CHECKLIST.md](docs/QUALITY_CHECKLIST.md), [COMMANDS.md](docs/COMMANDS.md) reference, TOCs in long docs.
- Updated architecture, configuration, contributing, developer setup, and writing commands docs for migrations, setup wizard, git hooks, and permission bootstrap behavior.
- Command file naming rules in `docs/WRITING_COMMANDS.md`.
- SQLite scaling notes in `docs/ARCHITECTURE_MAP.md`.
- Import conventions in `docs/CONTRIBUTING.md`.
- `dev:watch` recommended for local development in README and developer setup docs.
