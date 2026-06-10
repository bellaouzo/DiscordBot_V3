# Testing Strategy

This repository favors fast unit and focused integration-style tests around command and event behavior.

## What to Unit Test

- Pure helpers and formatters (`src/Utilities`, command formatter helpers).
- Validation logic (date parsing, option parsing, permission checks).
- Database query/store behavior with isolated temporary `DATA_DIR` databases.

## What to Test as Integration-Style

- Command flows where Discord interactions are staged across steps:
  - example: select menu -> modal -> persistence -> response edits.
  - reference examples in-repo: [`tests/commands/AppealCommand.test.ts`](../tests/commands/AppealCommand.test.ts) (modal/select lifecycle), [`tests/commands/HelpCommand.lifecycle.test.ts`](../tests/commands/HelpCommand.lifecycle.test.ts) (registered button -> edit reply), [`tests/systems/Setup/selectHandlers.lifecycle.test.ts`](../tests/systems/Setup/selectHandlers.lifecycle.test.ts) (setup select menu -> draft + refresh).
- Event handlers with realistic message/member payload shape and mock responder/database surfaces.
- Multi-step moderation workflows where one command touches multiple domains (appeals, warnings, temp actions).

## Recommended Test Layout

- `tests/commands/*` for slash command behavior and interaction lifecycles.
- `tests/events/*` for event-path behavior and side effects.
- `tests/database/*` for persistence behavior and query expectations.
- `tests/systems/*` for larger feature modules that coordinate domain logic.

## Reliability Expectations

- Prefer assertions on both user-visible response and side effects.
- For lifecycle flows, assert registration calls and callback execution behavior.
- For failures, assert safe fallback messages and logging paths.
- Avoid brittle snapshot-only tests; assert specific key fields and outcomes.

## Infrastructure Tests

- **Command loader:** `tests/bot/CreateCommandLoader.test.ts` loads every `*Command.ts` file and asserts no duplicate names.
- **Event loader:** `tests/bot/CreateEventLoader.test.ts` loads every `*Event.ts` file without errors.
- **Interaction routing:** `tests/bot/interaction-handlers.test.ts` covers component dispatch and slash command handler registration.
- **Bot factory:** `tests/bot/CreateBot.test.ts` validates client intents and login wiring.
- **Bootstrap:** `tests/bootstrap.smoke.test.ts`, `tests/bootstrap.integration.test.ts`, and `tests/bootstrap.shutdown.test.ts` cover startup, strict config keys, and graceful shutdown.
- **Deployer / logging:** `tests/bot/CreateCommandDeployer.test.ts`, `tests/utilities/DiscordLogger.test.ts`.
- **Shared routers:** `tests/shared/ModalRouter.test.ts`, `tests/shared/ComponentRouter.test.ts`, `tests/shared/Paginator.test.ts`, `tests/responders/PaginatedResponder.test.ts`.
- **HTTP client:** `tests/utilities/ApiClient.test.ts`.
- **Schedulers:** `tests/systems/Giveaway/GiveawayScheduler.test.ts`, `tests/moderation/TempActionScheduler.test.ts`, and `tests/moderation/RaidModeScheduler.test.ts` use fake timers for sweep behavior.
- **Roblox bridge:** `tests/systems/Roblox/*` for connect/disconnect/status, kick, group audit/info, `bridgeApi`, `bridgeAccess`, and `bridgeSettings`.
- **Branch gate suite:** `tests/coverage/branchGateBoost.test.ts` consolidates high-branch paths (appeal shared helpers, fun API commands).
- **Duplicate command guard:** `npm run check:commands` statically scans top-level `CreateCommand({ name })` values.

## Coverage Expectations

- Global floors: **65% lines**, **55% branches**, **65% statements**, **68% functions**.
- Per-module thresholds in `vitest.config.mts` for `ApiClient`, routers, `Bootstrap`, and Roblox handlers.
- Economy handler branch floor: **40%**.
- Appeal flow branch floor: **35%**.
- `CooldownMiddleware` branch floor: **65%**.
- Run `npm run test:coverage` before opening a PR; CI enforces the same gates.

## Examples

Reference files under `examples/` are typechecked and linted via `npm run lint:examples` (`tsc --noEmit -p examples/tsconfig.json` plus ESLint). Use the same path aliases as production code (`@commands`, `@middleware`, `@utilities`).

## Adding New Features Checklist

1. Add/extend tests in at least one behavior path and one failure path.
2. If persistence changes, add or update database tests with meaningful assertions.
3. If interaction flow is multi-step, include a lifecycle test that executes registered callbacks.
4. Run:
   - `npm run lint`
   - `npm run lint:examples`
   - `npm test`
   - `npm run test:coverage`
   - `npm run check:commands`
