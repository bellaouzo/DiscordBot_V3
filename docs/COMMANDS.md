# Commands Reference

User-facing slash command reference. Run `/help` in Discord for an interactive list.

Some commands require staff roles (configured in `/setup`) or enabled feature modules. See [Server Setup Guide](SERVER_SETUP.md).

## Admin

| Command | Description |
|---------|-------------|
| `/setup` | Interactive server configuration wizard (staff roles, features, channels) |

## Moderation

| Command | Description |
|---------|-------------|
| `/kick` | Kick a member from the server |
| `/ban` | Ban a member (supports temporary bans) |
| `/unban` | Remove a ban |
| `/warn` | Issue a warning to a member |
| `/mute` | Mute a member in text channels |
| `/purge` | Bulk-delete messages in a channel |
| `/lockdown` | Lock or unlock a channel |
| `/slowmode` | Set channel slowmode |
| `/raidmode` | Activate or deactivate raid protection |
| `/note` | Add a staff note on a member |
| `/casefile` | View a member's moderation casefile |
| `/modhistory` | Summary of a member's moderation history |
| `/warnings` | List warnings for a member |
| `/tempactions` | View active temporary mutes and bans |
| `/banlist` | List banned users |
| `/linkfilter` | Configure allowed and blocked link patterns |
| `/appeal` | Submit or view ban/mute appeal history |
| `/appeal-admin` | Staff tools to list and review appeals |
| `/economyadmin` | Admin economy controls (balances, inventory) |
| `/roblox` | Roblox bridge integration (optional; requires host config) |

## Utility

| Command | Description |
|---------|-------------|
| `/help` | Interactive command help with categories |
| `/hub` | Server management hub |
| `/ticket` | Support ticket system (open, manage, transcripts) |
| `/giveaway` | Create and manage giveaways |
| `/poll` | Create and manage polls |
| `/event` | Schedule and manage server events |
| `/announce` | Send formatted announcements |
| `/autorole` | Configure automatic role assignment |
| `/reactionrole` | Set up reaction roles |
| `/starboard` | Configure the starboard |
| `/verify` | Verification panel and settings |
| `/xpconfig` | Configure leveling and XP settings |
| `/command` | Enable or disable commands for the server |
| `/commandlogs` | Export command usage logs |
| `/presence` | Set bot presence and activity |
| `/ping` | Check bot latency |
| `/health` | Bot health and status overview |
| `/debug` | Developer diagnostics (restricted) |

## Fun

| Command | Description |
|---------|-------------|
| `/profile` | View your or another member's profile |
| `/rank` | View XP rank and progress |
| `/leaderboard` | Server XP or coin leaderboard |
| `/economy` | Coins, games, and shop (requires economy enabled in setup) |
| `/weather` | Weather lookup (requires host API key) |
| `/news` | News headlines (requires host API key) |
| `/apod` | NASA Astronomy Picture of the Day (requires host API key) |
| `/meme` | Random meme |
| `/joke` | Random joke |
| `/fact` | Random fact |
| `/trivia` | Trivia question |
| `/translate` | Translate text |
| `/quote` | Inspirational quote |
| `/insult` | Playful insult generator |

## Feature gates

| Module | Commands affected | Enable in |
|--------|-------------------|-----------|
| Economy | `/economy`, `/economyadmin` | `/setup` step 3 |
| Giveaways | `/giveaway` | `/setup` step 3 |
| Leveling | `/rank`, `/leaderboard` (XP), chat XP | `/setup` step 3 |
| Starboard | Starboard messages | `/setup` steps 3 and 5 |
| Verification | `/verify`, verification flows | `/setup` steps 3 and 5 |

## See also

- [Server Setup Guide](SERVER_SETUP.md) — configure roles and features
- [Guild Configuration](CONFIGURATION.md) — how settings are stored
- [Documentation hub](README.md)

> **Contributors:** Update this file when adding or renaming user-visible slash commands.
