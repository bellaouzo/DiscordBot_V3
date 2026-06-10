# API Stability Policy

Discord Bot V3 follows [semantic versioning](https://semver.org/) for the bot framework surface documented in this repository.

## Stable (semver guarantees)

These areas are intended to remain backward compatible within a major version:

- `CreateCommand` shape, `CommandConfig`, and `Config.*` middleware builders
- Path aliases (`@commands`, `@middleware`, `@utilities`, `@shared`, `@database`, `@responders`, `@events`, `@config`, `@bot`, `@systems`)
- Responder interfaces (`InteractionResponder`, `ButtonResponder`, routers, `PaginatedResponder`)
- Database facade method signatures under `src/Database/`
- Bootstrap entry contract: `Bootstrap()`, `SetupGracefulShutdown()`, `SetupGlobalErrorHandlers()`, and `AppResources`

Breaking changes require a major version bump, a `CHANGELOG.md` entry, and a short migration note when behavior changes are non-trivial.

## Experimental (may change without a major bump)

- Roblox bridge commands, handlers, and `bridgeApi` request/response shapes
- Economy minigame handlers and payout tuning
- Fun commands that depend on third-party APIs (weather, news, APOD, etc.)
- Per-guild setup wizard UI copy and step ordering

Experimental modules may gain tests and coverage gates without a stability promise.

## Deprecation process

1. Mark the API deprecated in code and document the replacement in `CHANGELOG.md` under **Unreleased**.
2. Keep the old path working for at least one minor release when feasible.
3. Remove deprecated APIs in the next major release with a migration note.

## Version alignment

- `package.json` `version` is the shipped framework version.
- Run `npm run version:check` before tagging a release to confirm `CHANGELOG.md` includes a matching `## [x.y.z]` section.
- Tag releases as `vMAJOR.MINOR.PATCH` to trigger [.github/workflows/release.yml](../.github/workflows/release.yml).
