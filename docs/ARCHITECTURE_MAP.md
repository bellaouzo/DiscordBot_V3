# Architecture Map

This document is the quick map for core runtime boundaries and request flow.

## Runtime Boundaries

- `src/index.ts` bootstraps config, databases, responders, command/event loaders, and schedulers.
- `src/Bot` owns Discord client lifecycle, dynamic command loading, and event registration glue.
- `src/Commands` owns slash command behavior, permission constraints, and response orchestration.
- `src/Events` owns event-driven workflows that do not begin with slash commands.
- `src/Responders` owns safe interaction response lifecycle (`reply`, `defer`, `edit`, component routing).
- `src/Database` owns persistence adapters and query logic for each SQLite domain.
- `src/Systems` owns larger workflows with independent domain logic (Economy, Ticket, Giveaway, Roblox).
- `src/Utilities` owns shared formatting, API client, managers, and reusable command helpers.

## Moderation Domain Map

- `src/Commands/Moderation/AppealCommand.ts` is the command entry-point and subcommand router.
- `src/Commands/Moderation/Appeal/AppealSubmitFlow.ts` owns select -> modal -> appeal creation flow.
- `src/Commands/Moderation/Appeal/AppealReviewFlow.ts` owns reviewer resolution and review-message sync.
- `src/Commands/Moderation/Appeal/AppealShared.ts` owns reusable cross-flow helpers.
- `src/Database/ModerationDatabase.ts` is the moderation persistence facade.
- `src/Database/Moderation/Stores` owns focused sub-stores:
  - `TempActionStore` for mute/ban temp lifecycle rows.
  - `ModerationEventStore` for moderation history events.
  - `AppealStore` for appeal persistence and state transitions.

## Request Flow

1. Discord emits an interaction/event.
2. `RegisterEvents` or interaction handlers route to command/event implementation.
3. Command/event executes through responder utilities and database facade(s).
4. Domain helpers in `Utilities` format embeds/components and enforce shared logic.
5. Database facades delegate to domain stores and return typed records.
6. Response is emitted via responder wrappers to prevent raw Discord API lifecycle mistakes.

## Configuration Flow

1. `LoadAppConfig()` validates hard-required startup vars.
2. `LoadApiConfig()` resolves optional third-party API endpoints and credentials.
3. `ListMissingRequiredFeatureApiKeys()` logs missing optional feature credentials at startup.
4. Commands call config guards before external API requests and fail safely for end users.
