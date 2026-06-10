# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- `RequireGuild`, `RequireGuildFromInteraction`, and `RequireDefined` utilities for safe guild/value access.
- Command loader integration test (`tests/bot/CreateCommandLoader.test.ts`).
- Bootstrap smoke test (`tests/bootstrap.smoke.test.ts`).
- Error middleware and interaction responder test coverage.
- Static duplicate command name check (`npm run check:commands`).
- Examples lint step in CI (`npm run lint:examples`).

### Changed

- Removed duplicate `HelpCommand` re-export barrel; help command loads from `Utility/Help/HelpCommand.ts` only.
- Hardened command loader to skip re-export-only `*Command.ts` barrels.
- Standardized imports to path aliases (`@commands`, `@utilities`, etc.).
- Removed unused `CommandConfig.custom` escape hatch.
- Raised global branch coverage gate from 32% to 42%.
- Economy handler branch coverage gate raised from 25% to 35%.

### Documentation

- Command file naming rules in `docs/WRITING_COMMANDS.md`.
- SQLite scaling notes in `docs/ARCHITECTURE_MAP.md`.
- Import conventions in `docs/CONTRIBUTING.md`.
- `dev:watch` recommended for local development in README and developer setup docs.
