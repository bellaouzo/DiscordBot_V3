# Module Ownership

Ownership in this repository is feature-based. If a change spans multiple areas, coordinate with the owner listed here first.

## Ownership Areas

- **Core bootstrap and runtime wiring**
  - Paths: `src/index.ts`, `src/Bootstrap.ts`, `src/Bootstrap/SystemRegistry.ts`, `src/Bot`, `src/Responders`
  - Scope: startup, shutdown, command/event registration, global system handler registration, interaction lifecycle safety.

- **Database and migrations**
  - Paths: `src/Database`, `src/Database/Migrations`
  - Scope: SQLite facades, stores, schema migrations, and migration tests.

- **Moderation and safety systems**
  - Paths: `src/Commands/Moderation`, `src/Database/Moderation*`, `src/Moderation`
  - Scope: warns/notes/actions, appeals, temp actions, link filtering, raid mode.

- **Fun command integrations**
  - Paths: `src/Commands/Fun`, `src/Config/ApiConfig.ts`, `src/Utilities/ApiClient.ts`
  - Scope: third-party API consumers, response formatting, API key guardrails.

- **Ticket and support operations**
  - Paths: `src/Commands/Utility/Ticket*`, `src/Systems/Ticket`, `src/Database/TicketDatabase.ts`
  - Scope: ticket creation, transcript/export flows, ticket message persistence.

- **Economy and leveling**
  - Paths: `src/Systems/Economy`, `src/Systems/Leveling`, economy-related commands and tests.
  - Scope: balances, XP progression, rewards, market rotation behavior.

- **Setup wizard**
  - Paths: `src/Systems/Setup`, `src/Commands/Utility/SetupCommand.ts`
  - Scope: multi-step guild configuration, feature toggles, draft persistence.

- **Roblox bridge**
  - Paths: `src/Commands/Moderation/RobloxCommand.ts`, `src/Systems/Roblox`
  - Scope: bridge config validation, Roblox action handlers, connection security controls.

## Change Ownership Rules

- Keep domain logic in its owned area; avoid leaking feature-specific behavior into generic utilities.
- Keep persistence changes aligned with the owning database facade and its related tests.
- Any new external API feature must update both:
  - `src/Config/ApiConfig.ts`
  - `docs/CONFIGURATION.md` and `.env.example`
