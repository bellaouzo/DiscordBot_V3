# Contributing

Guidelines for contributing to Discord Bot V3: coding standards, scripts, and what to do before opening a PR.

## Before you submit

1. **Lint:** `npm run lint` must pass (TypeScript check + ESLint).
2. **Test:** `npm run test` must pass.
3. **Format:** Code should follow project style. Run `npm run format` to apply Prettier to `src/`, or `npm run format:check` to verify without changing files.

CI runs `npm run lint` and `npm run test` on push and pull requests to `main`; see [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## Coding standards

- **Style:** Use the existing patterns in the repo: path aliases (`@commands`, `@middleware`, etc.), consistent spacing and returns, guard clauses where they keep logic clear.
- **Comments:** Avoid inline comments that restate what the code does. Use comments for section headers or non-obvious behavior only.
- **Utilities:** Prefer shared utilities (e.g. `EmbedFactory`, `CreateGuildResourceLocator`, responders, config builders) over one-off implementations.
- **Validation and errors:** Use middleware for cross-cutting checks (e.g. guild-only via `config.guildOnly`, permissions via `Config.mod()` / `Config.utility()`). Let `ErrorMiddleware` handle generic failures; keep try/catch only for partial or domain-specific handling.

## Project structure

- **Commands** – Slash commands in `src/Commands/` (Fun, Moderation, Utility). Use `CreateCommand` and `Config` from `@middleware` for middleware and permissions.
- **Middleware** – `src/Commands/Middleware/` (logging, permissions, cooldowns, guild-only, error handling). Add new middleware there and wire it in `AutoMiddleware` or command config as needed.
- **Systems** – Economy, Giveaway, Leveling, Setup, Ticket in `src/Systems/`.
- **Tests** – Vitest tests in `tests/`; mirror `src/` layout (e.g. `tests/commands/`, `tests/systems/`). Use helpers and mocks from `tests/helpers/`.

## Commits and PRs

- Keep commits focused; PRs should be scoped to a clear change or feature.
- PR description should summarize what changed and why; reference issues if applicable.

## Questions

Open an issue for bugs, feature ideas, or documentation gaps.
