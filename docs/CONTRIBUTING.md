# Contributing

Guidelines for contributing to Discord Bot V3: coding standards, scripts, and what to do before opening a PR.

## Before you submit

1. **Lint:** `npm run lint` must pass (TypeScript check + ESLint).
2. **Test:** `npm run test` must pass.
3. **Format:** Code should follow project style. Run `npm run format` to apply Prettier to `src/`, or `npm run format:check` to verify without changing files.

CI runs `npm audit --audit-level=high`, `npm run lint`, `npm run test`, `npm run test:coverage`, and a [Gitleaks](https://github.com/gitleaks/gitleaks) scan on push and pull requests to `main`/`master`. Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml).

### Dependency audit policy

- CI **fails** when `npm audit` reports **high** or **critical** severity advisories.
- Moderate and low advisories are logged but do not block merges.
- When audit fails, prefer `npm audit fix` or a targeted dependency bump in the same PR. Document any justified exceptions in the PR description.
- The leak scan uses full git history (`fetch-depth: 0`) so moved or renamed secrets in older commits are still detected.

## Coding standards

- **Style:** Use the existing patterns in the repo: path aliases (`@commands`, `@middleware`, etc.), consistent spacing and returns, guard clauses where they keep logic clear.

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
- **Middleware** – `src/Commands/Middleware/` (logging, permissions, cooldowns, guild-only, error handling). New built-in middleware should be registered in `AutoMiddleware`; command authors configure behavior through `CommandConfig`.
- **Systems** – Economy, Giveaway, Leveling, Setup, Ticket in `src/Systems/`.
- **Tests** – Vitest tests in `tests/`; mirror `src/` layout (e.g. `tests/commands/`, `tests/systems/`). Use helpers and mocks from `tests/helpers/`.

### Reference docs for contributors

- Architecture boundaries: [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md)
- Ownership and feature responsibility: [MODULE_OWNERSHIP.md](./MODULE_OWNERSHIP.md)
- Test strategy and coverage expectations: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
- Configuration and secret handling: [CONFIGURATION.md](./CONFIGURATION.md)

## Commits and PRs

- Keep commits focused; PRs should be scoped to a clear change or feature.
- PR description should summarize what changed and why; reference issues if applicable.

## Questions

Open an issue for bugs, feature ideas, or documentation gaps.
