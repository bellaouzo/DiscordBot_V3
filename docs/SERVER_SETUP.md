# Server Setup Guide

This guide is for **Discord server admins** — people configuring the bot inside Discord, not editing code or `.env` files.

For hosting the bot (tokens, API keys, deployment), see [Environment Variables](ENVIRONMENT.md). For a list of slash commands, see [Commands Reference](COMMANDS.md).

## Who can run `/setup`

**First time (before setup is saved):**

- You need Discord **Administrator** or **Manage Server** permission.
- If you lack that permission, the bot shows **Setup Required** and asks you to find someone who can run `/setup`.

**After setup is saved:**

- Users with configured **admin roles** (chosen in step 2) can run admin commands, including `/setup` again.
- Discord administrators still have full access even if they are not in a configured admin role.

> **Tip:** Run `/setup` yourself the first time, then assign admin roles to trusted staff so they can manage settings later.

## Running `/setup`

1. In your server, type `/setup` and run the command.
2. The bot opens a **private setup wizard** (only you see it).
3. Walk through **6 steps**, then click **Save & Finish** on the last step.

Changes stay in your session until you save. You can go **Back** or **Cancel** without saving.

### The six steps

| Step | Name | What you configure |
|------|------|-------------------|
| 1 | Welcome | Overview — click **Get Started** |
| 2 | Staff & Roles | Admin roles and mod roles |
| 3 | Feature Modules | Turn features on or off (economy, leveling, etc.) |
| 4 | Support & Logging | Ticket/appeal categories and log channels |
| 5 | Community | Welcome, announcements, and channels for enabled features |
| 6 | Review & Save | Confirm everything, then **Save & Finish** |

## Step-by-step details

### Step 1 — Welcome

Introduces the wizard. Click **Get Started** to begin.

### Step 2 — Staff & Roles

Choose which roles can use bot commands:

- **Admin roles** — full access to admin commands (setup, economy admin, etc.)
- **Mod roles** — moderation commands (kick, ban, warn, tickets, appeals, etc.)

Select at least one admin role before saving. Mod roles are optional but recommended for your moderation team.

> **Note:** Discord **Administrator** permission still grants admin access even without a configured role.

### Step 3 — Feature Modules

Toggle each module **On** or **Off** for your server:

| Module | When enabled |
|--------|--------------|
| **Economy** | `/economy` commands, coins, games, lotteries |
| **Leveling** | Chat XP, ranks, level-up messages |
| **Starboard** | Popular messages posted to a starboard channel (configure channel on step 5) |
| **Verification** | New members must verify before full access (configure on step 5) |
| **Giveaways** | `/giveaway` commands and entry buttons |

Turning a module **Off** blocks related commands for everyone in the server.

### Step 4 — Support & Logging

Configure where support and staff activity are handled:

- **Ticket category** — where new support ticket channels are created
- **Appeal category** — where ban-appeal review channels are created
- **Command log channel** — logs staff command usage
- **Ticket log channel** — logs ticket open/close events

### Step 5 — Community

Optional channels for community features. Extra options appear based on what you enabled in step 3:

- **Delete logs** — message deletion audit log
- **Announcements** — default channel for announcements
- **Welcome channel** — where welcome messages are sent
- **Production logs** — optional deployment/status logs (usually for the bot host)

If enabled in step 3:

- **Starboard channel** — where starred messages are reposted
- **Level-up channel** — where rank-up messages are sent
- **Verification channel** and **unverified/verified roles** — gate for new members

### Step 6 — Review & Save

Review your choices. Fix anything with **Back**, then click **Save & Finish**.

You can run `/setup` again anytime to change settings.

## Common admin tasks

| Task | How |
|------|-----|
| Change staff roles or features | Run `/setup` again and save on step 6 |
| See available commands | Run `/help` |
| Disable a command for the server | Use `/command` (admin) if enabled on your server |
| Turn economy or giveaways off | `/setup` → step 3 → toggle Off → save |

> **Note:** Some fun commands (weather, news, etc.) need API keys configured by whoever **hosts** the bot. If a command says it is not configured, contact your bot host — that is not fixed in `/setup`.

## Troubleshooting

### "Setup Required"

The server has not been set up yet, and you do not have Administrator or Manage Server permission. Ask a server owner or admin to run `/setup`.

### "Missing Admin Role" or "Missing Mod Role"

Setup is complete, but your roles are not in the configured admin/mod lists. An existing admin should run `/setup` and add your role on step 2, or grant you Discord Administrator permission.

### "Economy Disabled" or "Giveaways Disabled"

That feature was turned off in setup step 3. An admin can re-enable it in `/setup`.

### Commands not showing in Discord

Slash commands are registered when the **bot starts**. If commands are missing:

- Wait a few minutes (global commands can take up to an hour).
- Ask the bot host to restart the bot or check that it is online.
- This is not fixed inside `/setup`.

### Setup session expired

The wizard times out after about 10 minutes of inactivity. Run `/setup` again.

## See also

- [Commands Reference](COMMANDS.md) — slash commands by category
- [Guild Configuration](CONFIGURATION.md) — technical details on stored settings
- [Documentation hub](README.md)
