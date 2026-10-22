# Writing Commands

Guide to command structure, middleware, responders, and utilities in the Discord Bot V3 framework.

> **Read this first:** [Basic Command Structure](#basic-command-structure) → [Config](#config) → [Subcommands, shortcuts and right-click menus](#subcommands-shortcuts-and-right-click-menus) → [Middleware System](#middleware-system) → [Reference — Responder System](#reference--responder-system) (lookup when needed)

## Table of contents

- [Basic Command Structure](#basic-command-structure)
- [Config](#config)
- [Subcommands, shortcuts and right-click menus](#subcommands-shortcuts-and-right-click-menus)
- [Middleware System](#middleware-system)
- [Command File Naming](#command-file-naming)
- [Utilities](#utilities)
- [Reference — Responder System](#reference--responder-system)

## Basic Command Structure

The quickest start is `npm run new:command -- <Group> <Name>` (add `--subcommands` for a [subcommand table](EXTENDING.md#subcommands)), which creates the command and a test.

```typescript
import { CreateCommand } from "@commands";

async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;
  const result = await doSomething();
  await interactionResponder.Reply(interaction, {
    content: `Operation completed: ${result}`,
  });
}

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  config: { cooldown: "5s", autoDefer: true },
  execute: ExecuteMyCommand,
});
```

## Config

`config` is a plain object. Your editor autocompletes every option and its allowed values, and hovering an option shows its documentation (`CommandConfig` in `src/Commands/Middleware/CommandConfig.ts`). Everything is optional; the defaults are **server only, anyone can use it, no cooldown**.

| Option | Values | What it does |
|--------|--------|--------------|
| `access` | `"everyone"` (default), `"mod"`, `"admin"`, `"serverOwner"`, `"botOwner"` | Who may run it. `mod`/`admin` use the roles set in `/setup`, with Discord permissions as a fallback |
| `cooldown` | `"500ms"`, `"5s"`, `"2m"`, `"1h"`, or `false` | Per-user cooldown. `false` removes an inherited one |
| `botPermissions` | e.g. `["BanMembers"]` | Permissions the **bot** needs in the channel; missing ones are named to the user |
| `autoDefer` | `true` or `"ephemeral"` | Defers if the handler hasn't replied within ~2s (for slow APIs) |
| `feature` | e.g. `"economy"` | A per-server feature toggle that must be on |
| `userPermissions` | e.g. `["ManageGuild"]` | Discord permissions the **user** needs, on top of `access` |
| `anyUserPermission` | `true` | With `userPermissions`, one of them is enough |
| `role` | role ID | A role the user must have |
| `dms` | `true` | Also allow the command in DMs |

```typescript
config: { cooldown: "3s" }
config: { access: "mod", cooldown: "5s", botPermissions: ["BanMembers"] }
config: { feature: "economy", cooldown: "5s" }
config: { access: "botOwner", dms: true }
```

Middleware is picked from the config automatically. You never list `CooldownMiddleware` or similar on a command.

## Subcommands, shortcuts and right-click menus

### Per-subcommand config

A subcommand can override any config field for itself. Fields it sets replace the command's; everything else is inherited. Table-style subcommands put it on the entry:

```typescript
subcommands: [
  { name: "open", description: "Open a ticket", execute: Open,
    config: { botPermissions: ["ManageChannels"], cooldown: "30s" } },
  { name: "list", description: "List tickets", execute: List },
]
```

Commands that add subcommands in `configure` use `subcommandConfig`, keyed by path (`"status"`, `"config add"`):

```typescript
config: { access: "mod", botPermissions: ["ManageChannels", "ManageRoles"] },
subcommandConfig: { status: { botPermissions: [] } },
```

A key that isn't a real subcommand throws at startup, so renaming a subcommand can't silently drop its override. A subcommand that sets its own `cooldown` gets its own cooldown; otherwise all subcommands share the command's.

### Shortcut aliases

Mark a table-style subcommand with `alias: true` to also register it as a top-level command with the same options, handler and config: `/economy daily` is also `/daily`. Use `alias: "name"` to pick a different name. Shortcuts share the parent's server toggle, channel restrictions and cooldown, and `/command disable daily` resolves to `/economy`. They don't appear separately in `/help`. The loader refuses to start if shortcuts push the total past Discord's 100-command limit.

### Right-click menus

`CreateUserMenu` / `CreateMessageMenu` add an entry to Discord's Apps menu. Export it from the linked command's file; the loader finds it. A menu inherits the linked command's config (plus a subcommand's override if you name one) and runs through the same middleware, so `/command disable warn` also disables the Warn menu.

```typescript
export const WarnUserMenu = CreateUserMenu({
  name: "Warn",
  command: WarnCommand,
  subcommand: "add",
  execute: async (interaction, context) => {
    await PromptModal({
      interaction,
      modalRouter: context.responders.modalRouter,
      title: `Warn ${interaction.targetUser.username}`,
      fields: [{ id: "reason", label: "Reason", style: "paragraph", required: true }],
      onSubmit: (submit, values) => WarnUser({ interaction: submit, context, ... }),
    });
  },
});
```

Discord allows 5 user menus and 5 message menus; the loader checks this. Current menus: **Warn**, **Mute**, **Kick**, **Casefile** and **View Profile** on users, and **Purge From Here** on messages.

`PromptModal` (`@shared/ModalPrompt`) shows a modal and hands you the trimmed values. A modal must be the interaction's first response, so don't set `autoDefer` on a menu that opens one.

## Middleware System

Middleware runs as a chain around your `execute` function. In normal commands you configure behavior through `config`; the framework builds the chain for you.

### Chain order

Every command runs this chain (`BuildMiddlewareChain` in `src/Bot/ExecuteCommand.ts`):

```
Error → Blocklist → Logging → CommandEnabled → ChannelRestriction      (global, every command)
  → Guild → Feature → Permission → BotPermission → Cooldown → AutoDefer (from config, via AutoMiddleware)
  → DiscordLogging → execute                                             (global)
```

The global middleware is added by the executor, so it applies even to commands that pass their own `middleware`. `ErrorMiddleware` is outermost, so a throw anywhere in the chain is logged and answered.

Middleware reads `context.config` (the config with the subcommand override applied and defaults filled in) and `context.invocation` (`commandName`, `path` such as `"economy daily"`, and `cooldownKey`).

### What `AutoMiddleware` adds

| When the resolved config has | Adds |
|------------------------------|------|
| server only (no `dms: true`) | `GuildMiddleware` |
| `feature` | `FeatureEnabledMiddleware` |
| `access` other than `everyone`, `userPermissions` or `role` | `PermissionMiddleware` |
| `botPermissions` | `BotPermissionMiddleware` |
| `cooldown` | `CooldownMiddleware` |
| `autoDefer` | `AutoDeferMiddleware` |

### Overriding the chain (advanced)

Pass `middleware: { before: [...], after: [...] }` only when you need a non-standard chain. It replaces the `AutoMiddleware` part only; the global middleware still runs. Most commands should omit `middleware` entirely.

### Custom middleware

Middleware uses a chain of responsibility pattern with `next()`:

```typescript
export const CustomMiddleware: CommandMiddleware = {
  name: "custom",
  execute: async (context, next) => {
    // Pre-execution logic
    console.log("Before command execution");

    await next(); // Call next middleware or command

    // Post-execution logic
    console.log("After command execution");
  },
};
```

### Built-in Middleware

**LoggingMiddleware**

- Logs `Command started`, then the outcome: `Command completed` (with `durationMs`), `Command blocked` (with `blockedBy`, the middleware that stopped it), or `Command threw`
- Warns with `Command slow` above 2.5s; such commands are candidates for `autoDefer: true`

**ErrorMiddleware**

- Catches and handles errors gracefully
- Provides user-friendly error messages
- Logs detailed error information

**PermissionMiddleware**

- Validates Discord permissions, configured staff roles, and owner-only commands
- Before setup: allows Discord **Administrator** / **Manage Server** holders to run admin commands; others see **Setup Required**
- After setup: checks configured admin/mod roles; Discord admins still bypass via `IsAdmin` / `IsModerator`
- Enforces `access`, `userPermissions` (all or any) and `role`
- Provides clear permission error messages

**FeatureEnabledMiddleware**

- Blocks commands when a per-guild feature is disabled (any toggleable feature in `@shared/Features`)
- Applied automatically when the config sets `feature`
- Reads toggle state through `IsFeatureEnabled` in `@shared/Features`

**CommandEnabledMiddleware**

- Blocks guild commands that an admin has disabled with `/command disable`
- Runs for every command (skipped in DMs and for protected commands)

**ChannelRestrictionMiddleware**

- Enforces channel allow-lists set with `/command restrict <name> <channel>` (clear with `/command unrestrict`)
- Threads count as their parent channel; admins and protected commands are exempt
- Runs for every command

**BlocklistMiddleware**

- Rejects users and servers on the global blocklist (managed by bot owners with `/blocklist`)
- Runs first for every command, and is also checked for buttons, select menus and modals
- Users in `BOT_OWNER_IDS` are never blocked

**BotPermissionMiddleware**

- Checks the bot's own permissions in the current channel (`interaction.appPermissions`, no API call) and names what's missing
- Set `botPermissions` on any command that bans, kicks, times out, deletes messages, edits channels or manages roles
- Read-only subcommands opt out with a `botPermissions: []` override

**AutoDeferMiddleware**

- Opt in with `autoDefer: true` (public) or `autoDefer: "ephemeral"`
- If the handler hasn't replied ~2s after the chain started, defers for it; `interactionResponder.Reply` then fills in the deferred reply
- Do **not** use on commands that call `showModal()` or raw `interaction.reply()`: both fail once the interaction is deferred
- The deferred reply's visibility is fixed at defer time, so an ephemeral error after a public auto-defer is shown publicly

**CooldownMiddleware**

- Rate limiting per user/command
- Durations like `"5s"`; subcommands with their own cooldown get their own key
- The cooldown is reserved when the check passes, so repeated clicks while a command is still running are rejected; it is released if the command throws
- Automatic cleanup of expired cooldowns

**GuildMiddleware**

- Ensures the command runs in a server (the default; `dms: true` turns it off)
- Replies with "Guild Only" and does not run the command when used in DMs

### Creating Custom Middleware

```typescript
import { CommandMiddleware } from "./Commands/Middleware";

export const AuditMiddleware: CommandMiddleware = {
  name: "audit",
  execute: async (context, next) => {
    const startTime = Date.now();

    await next();

    const duration = Date.now() - startTime;
    context.logger.Info("Command audit", {
      command: context.command.data.name,
      duration: `${duration}ms`,
      userId: context.interaction.user.id,
    });
  },
};
```

### Middleware Context

The `MiddlewareContext` object provides access to:

- `interaction` - The Discord interaction object
- `command` - The command definition
- `logger` - Structured logger instance
- `responders` - Response handling utilities
- `config` - Command-specific configuration

## Command File Naming

The command loader in `src/Bot/CreateCommandLoader.ts` recursively loads files matching `*Command.ts`. Follow these rules:

| Loadable | Not loadable |
|----------|--------------|
| `src/Commands/Fun/*Command.ts` | `*Flow.ts`, `*Shared.ts`, middleware files |
| `src/Commands/Moderation/*Command.ts` | Re-export-only barrels (`export { X } from "..."`) |
| `src/Commands/Utility/*Command.ts` | `CommandFactory.ts`, `registry.ts`, `index.ts` |
| Nested implementations (e.g. `Utility/Help/HelpCommand.ts`) | Files without a local `CreateCommand(` call |

Split complex commands into flow modules under subfolders (e.g. `Appeal/`, `Giveaway/`). Only the top-level or nested `*Command.ts` file that calls `CreateCommand` is registered.

## Utilities

- **`EmbedFactory.CreateSuccess()`** - Create success embeds
- **`ComponentFactory.CreateButton()`** - Create interactive buttons
- **`CreateGuildResourceLocator()`** - Easy guild data access

## Reference — Responder System

The responder system provides a comprehensive set of utilities for handling Discord interactions and responses.

### InteractionResponder

Handles slash command interactions with full lifecycle support:

- **`Reply()`** - Send initial response to interaction
- **`Edit()`** - Modify existing reply content
- **`FollowUp()`** - Send additional messages after initial reply
- **`Defer()`** - Show "thinking" state with optional ephemeral flag
- **`WithAction()`** - Show loading message, perform action, then update
- **`SendDm()`** - Send direct message to users

```typescript
// Basic reply
await interactionResponder.Reply(interaction, {
  content: "Hello!",
  ephemeral: true,
});

// Defer for long operations
await interactionResponder.Defer(interaction, true);
await doLongOperation();
await interactionResponder.Edit(interaction, {
  content: "Operation completed!",
});

// Action wrapper with loading state
await interactionResponder.WithAction({
  interaction,
  message: "Processing...",
  action: async () => {
    await processData();
  },
  followUp: "Done!",
});
```

### ButtonResponder

Manages button interactions and message updates:

- **`Update()`** - Update button interaction message
- **`DeferUpdate()`** - Acknowledge button without visual change
- **`EditMessage()`** - Edit the message containing the button
- **`EditReply()`** - Edit the bot's reply after defer
- **`Reply()`** - Send new reply to button interaction
- **`FollowUp()`** - Send follow-up message

```typescript
// Handle button click
await buttonResponder.Update(interaction, {
  content: "Button clicked!",
  components: [], // Remove buttons
});

// Defer and edit later
await buttonResponder.DeferUpdate(interaction);
await buttonResponder.EditMessage(interaction, {
  content: "Processing button click...",
});
```

### PaginatedResponder

Creates multi-page messages with automatic navigation:

- **`Send()`** - Create paginated message with navigation buttons
- Configuration options: ephemeral, ownerId (restrict navigation), timeouts
- Automatic button generation and routing
- Page structure with embeds, content, and custom components

```typescript
const pages = [
  { content: "Page 1 content", embeds: [embed1] },
  { content: "Page 2 content", embeds: [embed2] },
  { content: "Page 3 content", embeds: [embed3] },
];

await paginatedResponder.Send({
  interaction,
  pages,
  ephemeral: false,
  ownerId: interaction.user.id, // Only owner can navigate
  timeoutMs: 300000, // 5 minutes
});
```

### ComponentRouter & SelectMenuRouter

Handle button and select menu interactions by routing to registered handlers:

```typescript
componentRouter.RegisterButton({
  customId: "my-button",
  ownerId: interaction.user.id,
  handler: async (buttonInteraction) => {
    await buttonResponder.Update(buttonInteraction, {
      content: "Button handled!",
    });
  },
});

selectMenuRouter.RegisterSelectMenu({
  customId: "my-select",
  ownerId: interaction.user.id,
  handler: async (selectInteraction) => {
    const selected = selectInteraction.values[0];
    await interactionResponder.Reply(selectInteraction, {
      content: `You selected: ${selected}`,
    });
  },
});
```

### Response Patterns

Common patterns for different use cases:

**Ephemeral Replies** - Private responses only visible to the user

```typescript
await interactionResponder.Reply(interaction, {
  content: "This is private",
  ephemeral: true,
});
```

**Deferred Responses** - For long operations that need "thinking" state

```typescript
await interactionResponder.Defer(interaction, true);
await longOperation();
await interactionResponder.Edit(interaction, { content: "Done!" });
```

**Action Wrappers** - Show loading state during operations

```typescript
await interactionResponder.WithAction({
  interaction,
  message: "Working...",
  action: async () => await processData(),
  followUp: "Completed successfully!",
});
```

## See also

- [Extending the Bot](EXTENDING.md) — checklists for settings, features, buttons, jobs
- [Examples](../examples/) — copy-paste command templates
- [Architecture Map](ARCHITECTURE_MAP.md) — request flow and domain boundaries
- [Quality Checklist](QUALITY_CHECKLIST.md) — pre-PR requirements
- [Documentation hub](README.md)
