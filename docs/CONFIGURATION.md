# Guild Configuration

Per-guild settings configured through `/setup` in Discord. Stored in SQLite (`server.db`).

For bot hosting (tokens, API keys, deployment), see [Environment Variables](ENVIRONMENT.md).  
For a step-by-step wizard walkthrough, see [Server Setup Guide](SERVER_SETUP.md).

## Setup wizard

Run `/setup` to configure staff roles, feature modules, support categories, log channels, and community settings in a 6-step wizard:

Welcome → Staff roles → Feature modules → Support & logging → Community → Review & save

Full walkthrough: [SERVER_SETUP.md](SERVER_SETUP.md)

## Staff roles and permissions

Admin and mod commands check roles saved in `guild_settings`.

**Before setup is saved:**

- Users with Discord **Administrator** or **Manage Server** can run admin commands (including `/setup`).
- Everyone else sees **Setup Required**.

**After setup is saved:**

- Configured **admin roles** and **mod roles** (step 2) control access.
- Discord administrators still bypass role checks.

## Feature modules

Toggles from setup step 3. Stored per guild:

| Module | Storage | When off |
|--------|---------|----------|
| Economy | `guild_settings.economy_enabled` | `/economy` and `/economyadmin` blocked |
| Giveaways | `guild_settings.giveaways_enabled` | `/giveaway` blocked |
| Leveling | `guild_xp_settings.enabled` | Chat XP awards disabled |
| Starboard | `guild_settings.starboard_channel_id` | Starboard inactive (channel cleared when toggled off) |
| Verification | `guild_settings.verification_enabled` | Verification flows disabled |

`economy_enabled` and `giveaways_enabled` default to **on** for existing guilds.

> **Note:** Fun commands that call external APIs (weather, news, etc.) also need keys on the **bot host**. See [ENVIRONMENT.md](ENVIRONMENT.md).

## Developer reference

Commands gated by feature toggles use `Config.utilityWithFeature("economy" | "giveaways")`, which adds `FeatureEnabledMiddleware`. Permission logic lives in `src/Utilities/StaffPermissions.ts` and `PermissionMiddleware`.

When adding new guild settings:

1. Add a migration in `src/Database/Migrations/server/index.ts`
2. Update stores, types, and setup draft persistence
3. Document the toggle here and in [SERVER_SETUP.md](SERVER_SETUP.md)

See [Contributing — Database migrations](CONTRIBUTING.md#database-migrations) for the full process.

## See also

- [Server Setup Guide](SERVER_SETUP.md) — admin walkthrough
- [Commands Reference](COMMANDS.md) — slash commands by category
- [Environment Variables](ENVIRONMENT.md) — `.env` and deployment
- [Documentation hub](README.md)
