# Contributing

Guidelines for contributing to Discord Bot V3: coding standards, scripts, and what to do before opening a PR.

## Before you submit

See [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) for the full list of commands and coverage floors.

CI runs `npm audit --audit-level=high`, `npm run lint`, `npm run lint:examples`, `npm run format:check`, `npm run build`, `npm run check:commands`, `npm run test`, `npm run test:coverage`, and a [Gitleaks](https://github.com/gitleaks/gitleaks) scan on push and pull requests to `main`/`master`. Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml). Tagged `v*` releases run [.github/workflows/release.yml](../.github/workflows/release.yml).

### Dependency updates

- [Dependabot](../.github/dependabot.yml) opens weekly npm update PRs (devDependencies grouped).
- Review and merge Dependabot PRs like any other change: lint, tests, and coverage must stay green.

### Dependency audit policy

- CI **fails** when `npm audit` reports **high** or **critical** severity advisories.
- Moderate and low advisories are logged but do not block merges.
- When audit fails, prefer `npm audit fix` or a targeted dependency bump in the same PR. Document any justified exceptions in the PR description.
- The leak scan uses full git history (`fetch-depth: 0`) so moved or renamed secrets in older commits are still detected.

## Coding standards

- **Style:** Use the existing patterns in the repo: path aliases (`@commands`, `@middleware`, etc.), consistent spacing and returns, guard clauses where they keep logic clear.
- **Error handling:** Do not use empty `catch` blocks. Log with context via `Logger`, return a safe fallback, or rethrow when the failure must propagate.

### Import conventions

| Import | Use for |
|--------|---------|
| `@commands` | `CreateCommand`, `CommandContext`, command types |
| `@middleware` | `Config`, middleware types |
| `@utilities` | `EmbedFactory`, `RequireGuild`, guild helpers |
| `@shared` | `Logger`, routers, paginator |
| `@database` | Database facades and types |
| `@responders` | Interaction responders |
| `@events` | Event definitions |
| `@config` | App and API config |

Do not import from `@commands/CommandFactory` or use relative `../Commands/` paths outside `src/Commands/`. Use `RequireGuild(interaction)` instead of `interaction.guild!`.
- **Comments:** Avoid inline comments that restate what the code does. Use comments for section headers or non-obvious behavior only.
- **Utilities:** Prefer shared utilities (e.g. `EmbedFactory`, `CreateGuildResourceLocator`, responders, config builders) over one-off implementations.
- **Validation and errors:** Use middleware for cross-cutting checks (e.g. guild-only via `config.guildOnly`, permissions via `Config.mod()` / `Config.utility()`). Let `ErrorMiddleware` handle generic failures; keep try/catch only for partial or domain-specific handling.

## Project structure

- **Commands** – Slash commands in `src/Commands/` (Fun, Moderation, Utility). Use `CreateCommand` with `config: Config.utility()` / `Config.mod().build()` / etc. Middleware is applied via `AutoMiddleware(config)` — avoid hand-wiring `before` / `after` arrays unless you need a custom chain.
- **Middleware** – `src/Commands/Middleware/` (logging, permissions, feature gates, command enabled, cooldowns, guild-only, error handling). New built-in middleware should be registered in `AutoMiddleware`; command authors configure behavior through `CommandConfig`.
- **Systems** – Economy, Giveaway, Leveling, Setup, Ticket in `src/Systems/`.
- **Tests** – Vitest tests in `tests/`; mirror `src/` layout (e.g. `tests/commands/`, `tests/systems/`). Use helpers and mocks from `tests/helpers/`.

### Reference docs for contributors

- Architecture boundaries: [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md)
- Ownership and feature responsibility: [MODULE_OWNERSHIP.md](./MODULE_OWNERSHIP.md)
- Test strategy and coverage expectations: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
- API stability and semver policy: [STABILITY.md](./STABILITY.md)
- Configuration and secret handling: [ENVIRONMENT.md](./ENVIRONMENT.md)
- Guild settings from `/setup`: [CONFIGURATION.md](./CONFIGURATION.md)

## Database migrations

Each SQLite database (`server.db`, `tickets.db`, `users.db`, `moderation.db`) runs pending migrations automatically on startup via `RunMigrations` in its database constructor.

### When to add a migration

Add a new migration whenever you **ALTER an existing table** (new column, index change, backfill). Updating TypeScript types or store SELECT statements alone is not enough.

### How to add a migration

1. Add a new numbered entry in the migration array for that database:
   - `src/Database/Migrations/server/index.ts` for `server.db`
   - `src/Database/Migrations/ticket/index.ts` for `tickets.db`
   - Create `src/Database/Migrations/user/index.ts` or `moderation/index.ts` when the first schema change is needed for those databases (they currently use `RunMigrations([])`).
2. Use `AddTableColumnIfMissing` or `AddTableColumnsIfMissing` from `@database/Migrations` so the migration is idempotent.
3. Update the matching store, types, and mappers under `src/Database/`.
4. Update the `CreateTables` baseline DDL in the database class so **fresh installs** get the full schema immediately (migrations remain no-ops for new databases).
5. Add an integration test in `tests/database/` that simulates a database at the previous migration version, runs `RunMigrations`, and asserts the new schema works with the store.

### Anti-patterns

- **Do not** add columns to `GUILD_SETTINGS_COLUMNS` in `server/index.ts` — that map is frozen at v1 and only runs once on existing databases.
- **Do not** update TypeScript types or store queries without a matching migration and `CreateTables` baseline update.
- **Do not** rely on editing `CREATE TABLE IF NOT EXISTS` alone — existing production databases will not pick up new columns without a migration.

## Commits and PRs

- Keep commits focused; PRs should be scoped to a clear change or feature.
- PR description should summarize what changed and why; reference issues if applicable.
- When adding or renaming user-visible slash commands, update [COMMANDS.md](COMMANDS.md).

## Questions

Open an issue for bugs, feature ideas, or documentation gaps.

## See also

- [Quality Checklist](QUALITY_CHECKLIST.md) — pre-PR requirements
- [Documentation hub](README.md)
