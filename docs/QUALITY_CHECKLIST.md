# Quality Checklist

Single source of truth for what must pass before opening a pull request. CI runs the same gates on push/PR to `main`/`master`.

Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml)

## Before every pull request

Run these locally in order:

```bash
npm run lint
npm run lint:examples
npm run format:check
npm run test
npm run test:coverage
npm run check:commands
```

| Command | What it checks |
|---------|----------------|
| `npm run lint` | TypeScript (`tsc --noEmit`) + ESLint on `src/` and `tests/` |
| `npm run lint:examples` | TypeScript + ESLint on `examples/` |
| `npm run format:check` | Prettier formatting on `src/` and `tests/` |
| `npm run test` | Vitest unit and integration-style tests |
| `npm run test:coverage` | Tests + coverage threshold gates |
| `npm run check:commands` | No duplicate top-level slash command names |

Fix failures before opening the PR. Run `npm run format` if `format:check` fails.

## Coverage floors

Global minimums (enforced by `vitest.config.mts`):

| Metric | Floor |
|--------|-------|
| Lines | 65% |
| Branches | 55% |
| Statements | 65% |
| Functions | 68% |

Per-module thresholds also apply for selected paths. See [Testing Strategy](TESTING_STRATEGY.md#coverage-expectations).

## Git push hook

`npm install` registers a Husky **pre-push** hook that runs `npm run lint` automatically on `git push`.

The hook does **not** run tests or coverage — run the full checklist above before opening a PR.

If hooks are missing after clone:

```bash
npm run prepare
```

## CI extras

CI also runs:

- `npm audit --audit-level=high` — fails on high/critical advisories
- `npm run build` — TypeScript compile
- [Gitleaks](https://github.com/gitleaks/gitleaks) — secret scan on full git history

## See also

- [Contributing](CONTRIBUTING.md) — coding standards and PR process
- [Developer Setup](DEVELOPER_SETUP.md) — local install and git hooks
- [Testing Strategy](TESTING_STRATEGY.md) — what to test and where
- [Documentation hub](README.md)
