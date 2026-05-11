# Module Ownership

Ownership in this repository is feature-based. If a change spans multiple areas, coordinate with the owner listed here first.

## Ownership Areas

- **Core bootstrap and runtime wiring**
  - Paths: `src/index.ts`, `src/Bot`, `src/Responders`
  - Scope: startup, shutdown, command/event registration, interaction lifecycle safety.

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

- **Roblox bridge**
  - Paths: `src/Commands/Moderation/RobloxCommand.ts`, `src/Systems/Roblox`
  - Scope: bridge config validation, Roblox action handlers, connection security controls.

## Change Ownership Rules

- Keep domain logic in its owned area; avoid leaking feature-specific behavior into generic utilities.
- Keep persistence changes aligned with the owning database facade and its related tests.
- Any new external API feature must update both:
  - `src/Config/ApiConfig.ts`
  - `docs/CONFIGURATION.md` and `.env.example`
