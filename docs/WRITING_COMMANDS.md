# Writing Commands

Guide to command structure, middleware, responders, and utilities in the Discord Bot V3 framework.

## Basic Command Structure

Use `CreateCommand` with `Config` from `@middleware`; middleware is applied automatically via `AutoMiddleware(options.config)`. Override with `options.middleware` if needed.

```typescript
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";

async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;

  await interactionResponder.Defer(interaction, true);

  const result = await doSomething();

  await interactionResponder.Edit(interaction, {
    content: `Operation completed: ${result}`,
  });
}

export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  config: Config.utility(5),
  execute: ExecuteMyCommand,
});
```

Use `Config` presets for common cases:

| Preset | What it enables |
|--------|-----------------|
| `Config.utility(seconds)` | Guild-only, cooldown, logging, error handling |
| `Config.mod(seconds).build()` | Guild-only, mod role, cooldown, logging, error handling |
| `Config.admin(seconds)` | Guild-only, admin role, cooldown, logging, error handling |
| `Config.create()...build()` | Custom guild-only, Discord permissions, roles, cooldown |

Examples:

```typescript
config: Config.utility(5);
config: Config.mod(5).build();
config: Config.admin();
config: Config.create()
  .guildOnly()
  .permissions("ManageMessages", "KickMembers")
  .cooldownSeconds(10)
  .build();
```

You do **not** list `LoggingMiddleware`, `CooldownMiddleware`, and similar imports on each command. `CreateCommand` calls `AutoMiddleware(config)` when `middleware` is omitted.

## Middleware System

Middleware runs as a chain around your `execute` function. In normal commands you configure behavior through `config`; the framework builds the chain for you.

### What `AutoMiddleware` adds

From `src/Commands/Middleware/index.ts`, defaults are:

| Always | When `config` includes |
|--------|-------------------------|
| `LoggingMiddleware` (before) | `guildOnly` → `GuildMiddleware` |
| `ErrorMiddleware` (after) | permissions / mod / admin / owner / role → `PermissionMiddleware` |
| | `cooldown` → `CooldownMiddleware` |

`Config.utility()`, `Config.mod()`, and `Config.admin()` already set `guildOnly` and cooldown, so logging, guild check, permission (where applicable), cooldown, and error handling are wired without extra code.

### Overriding the chain (advanced)

Pass `middleware: { before: [...], after: [...] }` only when you need a non-standard chain. Most commands should omit `middleware` entirely.

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

- Logs command execution with user/guild context
- Tracks command performance and usage patterns

**ErrorMiddleware**

- Catches and handles errors gracefully
- Provides user-friendly error messages
- Logs detailed error information

**PermissionMiddleware**

- Validates Discord permissions, roles, and owner-only commands
- Supports `required` permissions (all or any)
- Checks for specific roles and server ownership
- Provides clear permission error messages

**CooldownMiddleware**

- Rate limiting per user/command
- Configurable durations (milliseconds, seconds, minutes)
- Automatic cleanup of expired cooldowns

**GuildMiddleware**

- Ensures the command runs in a guild when `config.guildOnly` is true
- Replies with "Guild Only" and does not run the command when used in DMs
- Applied automatically by `AutoMiddleware` when using `Config.mod()`, `Config.admin()`, or `Config.utility()`, or when `Config.create().guildOnly().build()` is used

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

## Responder System

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
